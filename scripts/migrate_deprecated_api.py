#!/usr/bin/env python3
"""
Migrate deprecated SQLAlchemy API calls:
  - Model.query.get(id) → db.session.get(Model, id)
  - Model.query.get_or_404(id) → db.session.get(Model, id) or abort(404)

Safe batch replacement for SMITH ERP.
"""

import re
import os
import glob

# Stats
stats = {
    'get_replaced': 0,
    'get_or_404_replaced': 0,
    'files_modified': 0,
    'abort_imports_added': 0,
    'db_imports_added': 0,
    'files_skipped': [],
    'details': []
}

def find_and_replace_balanced(content, method_name, replacement_template):
    """Find Model.query.method_name(...) with balanced parens and replace."""
    pattern = re.compile(r'\b([A-Z]\w+)\.query\.' + re.escape(method_name) + r'\(')
    
    replacements = []
    offset = 0
    
    for match in pattern.finditer(content):
        model = match.group(1)
        paren_start = match.end() - 1
        
        # Find matching closing paren
        depth = 1
        pos = paren_start + 1
        while pos < len(content) and depth > 0:
            if content[pos] == '(':
                depth += 1
            elif content[pos] == ')':
                depth -= 1
            pos += 1
        
        if depth == 0:
            arg = content[paren_start + 1:pos - 1].strip()
            full_match_start = match.start()
            full_match_end = pos
            replacement = replacement_template.format(model=model, arg=arg)
            replacements.append((full_match_start, full_match_end, replacement))
    
    # Apply replacements in reverse order to preserve positions
    result = content
    for start, end, replacement in reversed(replacements):
        result = result[:start] + replacement + result[end:]
    
    return result, len(replacements)


def ensure_abort_import(content):
    """Add abort to flask imports if not already present."""
    if 'abort' in content.split('\n')[0:30].__repr__():
        # Check if abort is already imported (in first 30 lines)
        for line in content.split('\n')[:30]:
            if 'abort' in line and ('from flask' in line or 'import' in line):
                return content, False
    
    # Find the flask import line and add abort
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.strip().startswith('from flask import'):
            if 'abort' not in line:
                # Add abort to the import
                # Handle multi-line imports
                if line.rstrip().endswith('\\') or line.rstrip().endswith(','):
                    # Multi-line import, just add to this line
                    lines[i] = line.rstrip().rstrip('\\').rstrip() + ', abort'
                else:
                    # Single line import
                    lines[i] = line.rstrip() + ', abort'
                return '\n'.join(lines), True
    
    # No flask import found, add one at the top after existing imports
    for i, line in enumerate(lines):
        if line.strip().startswith('from ') or line.strip().startswith('import '):
            continue
        if line.strip() == '' and i > 0:
            continue
        # Insert before first non-import line
        lines.insert(i, 'from flask import abort')
        return '\n'.join(lines), True
    
    return content, False


def ensure_db_import(content, filepath):
    """Ensure db is imported (needed for db.session.get)."""
    # Check if db is already imported
    for line in content.split('\n')[:30]:
        if 'db' in line and ('from models' in line or 'import db' in line):
            return content, False
    
    # For utils files, add db import
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.strip().startswith('from ') or line.strip().startswith('import '):
            continue
        if line.strip() == '' and i > 0:
            continue
        lines.insert(i, 'from models import db')
        return '\n'.join(lines), True
    
    return content, False


def process_file(filepath):
    """Process a single Python file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # First, replace get_or_404 (BEFORE get, since get pattern would match part of get_or_404)
    content, get_or_404_count = find_and_replace_balanced(
        content, 'get_or_404',
        'db.session.get({model}, {arg}) or abort(404)'
    )
    
    # Then replace query.get
    content, get_count = find_and_replace_balanced(
        content, 'get',
        'db.session.get({model}, {arg})'
    )
    
    if get_count == 0 and get_or_404_count == 0:
        return
    
    # Ensure abort is imported if get_or_404 was used
    abort_added = False
    if get_or_404_count > 0:
        content, abort_added = ensure_abort_import(content)
    
    # Ensure db is imported
    db_added = False
    if 'db.session.get' in content:
        content, db_added = ensure_db_import(content, filepath)
    
    # Write back
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        
        stats['get_replaced'] += get_count
        stats['get_or_404_replaced'] += get_or_404_count
        stats['files_modified'] += 1
        if abort_added:
            stats['abort_imports_added'] += 1
        if db_added:
            stats['db_imports_added'] += 1
        
        detail = f"  ✅ {filepath}: {get_count} query.get + {get_or_404_count} get_or_404"
        if abort_added:
            detail += " (+abort import)"
        if db_added:
            detail += " (+db import)"
        stats['details'].append(detail)
        print(detail)


def main():
    print("=" * 60)
    print("SMITH ERP — Deprecated SQLAlchemy API Migration")
    print("=" * 60)
    print()
    print("Pattern 1: Model.query.get(id) → db.session.get(Model, id)")
    print("Pattern 2: Model.query.get_or_404(id) → db.session.get(Model, id) or abort(404)")
    print()
    
    # Collect all files
    files = sorted(
        glob.glob('backend/routes/*.py') + 
        glob.glob('backend/utils/*.py')
    )
    
    # Also check root backend files
    root_py = [f for f in glob.glob('backend/*.py') if os.path.isfile(f)]
    files += sorted(root_py)
    
    print(f"Scanning {len(files)} files...")
    print()
    
    for filepath in files:
        try:
            process_file(filepath)
        except Exception as e:
            stats['files_skipped'].append((filepath, str(e)))
            print(f"  ❌ {filepath}: {e}")
    
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"  Files modified:        {stats['files_modified']}")
    print(f"  query.get replaced:    {stats['get_replaced']}")
    print(f"  get_or_404 replaced:   {stats['get_or_404_replaced']}")
    print(f"  Total replacements:    {stats['get_replaced'] + stats['get_or_404_replaced']}")
    print(f"  abort imports added:   {stats['abort_imports_added']}")
    print(f"  db imports added:      {stats['db_imports_added']}")
    
    if stats['files_skipped']:
        print(f"\n  ⚠️  Files skipped: {len(stats['files_skipped'])}")
        for f, e in stats['files_skipped']:
            print(f"    - {f}: {e}")
    
    print()
    print("✅ Migration complete!")


if __name__ == '__main__':
    main()
