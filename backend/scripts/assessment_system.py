#!/usr/bin/env python3
"""
ERP Assessment System - Complete Implementation
Comprehensive code quality, security, performance, and architecture assessment
"""

import os
import ast
import re
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Any, Tuple
import subprocess

class AssessmentSystem:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.results = {
            'metadata': {
                'assessment_date': datetime.now().isoformat(),
                'root_directory': str(root_dir),
                'version': '1.0.0'
            },
            'code_quality': {},
            'security': {},
            'performance': {},
            'architecture': {},
            'testing': {},
            'documentation': {},
            'overall_score': 0,
            'grade': '',
            'risk_level': ''
        }
        self.file_analysis = defaultdict(dict)
        self.issues = defaultdict(list)
        
    def run_full_assessment(self):
        """Run complete assessment"""
        print("=" * 100)
        print("ERP SYSTEM ASSESSMENT - COMPREHENSIVE ANALYSIS")
        print("=" * 100)
        print(f"Root Directory: {self.root_dir}")
        print(f"Assessment Date: {datetime.now().isoformat()}")

        # Debug path
        backend_dir = self.root_dir / 'backend'
        frontend_dir = self.root_dir / 'frontend' / 'src'
        print(f"Backend path: {backend_dir} — {'EXISTS' if backend_dir.exists() else 'NOT FOUND'}")
        print(f"Frontend path: {frontend_dir} — {'EXISTS' if frontend_dir.exists() else 'NOT FOUND'}")
        print("=" * 100)
        
        # Run all assessments
        self.assess_code_quality()
        self.assess_security()
        self.assess_performance()
        self.assess_architecture()
        self.assess_testing()
        self.assess_documentation()
        
        # Calculate overall score
        self.calculate_overall_score()
        
        # Generate report
        self.generate_report()
        
        print("=" * 100)
        print("ASSESSMENT COMPLETED")
        print("=" * 100)
    
    def assess_code_quality(self):
        """Assess code quality"""
        print("\n" + "=" * 100)
        print("ASSESSING CODE QUALITY...")
        print("=" * 100)
        
        backend_dir = self.root_dir / 'backend'
        frontend_dir = self.root_dir / 'frontend' / 'src'
        
        # Analyze backend
        if backend_dir.exists():
            backend_files = list(backend_dir.rglob('*.py'))
            print(f"Found {len(backend_files)} Python files")
            
            complexity_score = self.assess_complexity(backend_files)
            duplication_score = self.assess_duplication(backend_files)
            code_smells_score = self.assess_code_smells(backend_files)
            naming_score = self.assess_naming_convention(backend_files)
            documentation_score = self.assess_documentation_coverage(backend_files)
            
            # Calculate code quality score (weighted)
            self.results['code_quality'] = {
                'complexity': complexity_score,
                'duplication': duplication_score,
                'code_smells': code_smells_score,
                'naming': naming_score,
                'documentation': documentation_score,
                'overall_score': self.calculate_weighted_score({
                    'complexity': 0.30,
                    'duplication': 0.20,
                    'code_smells': 0.25,
                    'naming': 0.15,
                    'documentation': 0.10
                }, {
                    'complexity': complexity_score,
                    'duplication': duplication_score,
                    'code_smells': code_smells_score,
                    'naming': naming_score,
                    'documentation': documentation_score
                }),
                'files_analyzed': len(backend_files),
                'issues': len([i for i in self.issues['code_quality'] if i['severity'] in ['critical', 'high']])
            }
        
        # Analyze frontend
        if frontend_dir.exists():
            frontend_files = list(frontend_dir.rglob('*.ts')) + list(frontend_dir.rglob('*.tsx'))
            print(f"Found {len(frontend_files)} TypeScript/TSX files")
            
            # Similar analysis for frontend
            frontend_complexity = self.assess_typescript_complexity(frontend_files)
            frontend_smells = self.assess_typescript_smells(frontend_files)
            
            # Update results
            if 'overall_score' in self.results['code_quality']:
                self.results['code_quality']['frontend'] = {
                    'complexity': frontend_complexity,
                    'code_smells': frontend_smells,
                    'files_analyzed': len(frontend_files)
                }
        
        print(f"Code Quality Score: {self.results['code_quality'].get('overall_score', 0):.1f}/100")
    
    def assess_complexity(self, files: List[Path]) -> float:
        """Assess cyclomatic complexity"""
        total_complexity = 0
        total_functions = 0
        high_complexity_count = 0
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                tree = ast.parse(content)
                functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
                
                for func in functions:
                    complexity = self.calculate_function_complexity(func)
                    total_complexity += complexity
                    total_functions += 1
                    
                    if complexity > 20:
                        high_complexity_count += 1
                        self.issues['code_quality'].append({
                            'file': str(file_path.relative_to(self.root_dir)),
                            'type': 'high_complexity',
                            'severity': 'high',
                            'message': f'Function {func.name} has complexity {complexity} (>20)',
                            'line': func.lineno
                        })
            
            except Exception as e:
                continue
        
        if total_functions == 0:
            return 100.0
        
        avg_complexity = total_complexity / total_functions
        high_complexity_ratio = high_complexity_count / total_functions
        
        # Score based on average complexity
        if avg_complexity < 5:
            complexity_score = 100
        elif avg_complexity < 10:
            complexity_score = 90 - (avg_complexity - 5) * 2
        elif avg_complexity < 20:
            complexity_score = 70 - (avg_complexity - 10) * 3
        else:
            complexity_score = 40 - (avg_complexity - 20) * 2
        
        # Penalty for high complexity functions
        complexity_score -= high_complexity_ratio * 30
        
        return max(0, min(100, complexity_score))
    
    def calculate_function_complexity(self, func_node) -> int:
        """Calculate cyclomatic complexity of a function"""
        complexity = 1
        for node in ast.walk(func_node):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(node, ast.BoolOp):
                complexity += len(node.values) - 1
        return complexity
    
    def assess_duplication(self, files: List[Path]) -> float:
        """Assess code duplication using line hashing"""
        line_hashes = defaultdict(list)
        total_lines = 0
        duplicate_lines = 0

        for file_path in files:
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            try:
                lines = file_path.read_text(encoding='utf-8').splitlines()
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    # Skip blank lines, comments, simple statements
                    if len(stripped) > 30 and not stripped.startswith('#'):
                        line_hashes[stripped].append((str(file_path), i + 1))
                        total_lines += 1
            except Exception:
                continue

        if total_lines == 0:
            return 100.0

        for line, locations in line_hashes.items():
            if len(locations) > 1:
                duplicate_lines += len(locations) - 1

        dup_ratio = duplicate_lines / total_lines

        if dup_ratio < 0.03:
            return 100.0
        elif dup_ratio < 0.08:
            return 90.0 - (dup_ratio - 0.03) * 400
        elif dup_ratio < 0.15:
            return 70.0 - (dup_ratio - 0.08) * 300
        else:
            return max(0.0, 50.0 - (dup_ratio - 0.15) * 200)
    
    def assess_code_smells(self, files: List[Path]) -> float:
        """Assess code smells"""
        large_files = 0
        total_files = len(files)
        
        for file_path in files:
            try:
                lines = len(file_path.read_text(encoding='utf-8').split('\n'))
                
                if lines > 1000:
                    large_files += 1
                    self.issues['code_quality'].append({
                        'file': str(file_path.relative_to(self.root_dir)),
                        'type': 'large_file',
                        'severity': 'high',
                        'message': f'File has {lines} lines (>1000)',
                        'line': lines
                    })
                elif lines > 500:
                    self.issues['code_quality'].append({
                        'file': str(file_path.relative_to(self.root_dir)),
                        'type': 'large_file',
                        'severity': 'medium',
                        'message': f'File has {lines} lines (>500)',
                        'line': lines
                    })
            
            except Exception:
                continue
        
        if total_files == 0:
            return 100.0
        
        large_file_ratio = large_files / total_files
        
        # Score based on large file ratio
        if large_file_ratio < 0.05:
            return 100.0
        elif large_file_ratio < 0.10:
            return 90.0 - (large_file_ratio - 0.05) * 200
        elif large_file_ratio < 0.20:
            return 70.0 - (large_file_ratio - 0.10) * 300
        else:
            return 40.0 - (large_file_ratio - 0.20) * 200
    
    def assess_naming_convention(self, files: List[Path]) -> float:
        """Assess naming convention compliance (snake_case functions, PascalCase classes)"""
        good = 0
        bad = 0

        snake_case = re.compile(r'^[a-z_][a-z0-9_]*$')
        pascal_case = re.compile(r'^[A-Z][a-zA-Z0-9]*$')

        for file_path in files:
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            try:
                content = file_path.read_text(encoding='utf-8')
                tree = ast.parse(content)

                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        if snake_case.match(node.name):
                            good += 1
                        else:
                            bad += 1
                    elif isinstance(node, ast.ClassDef):
                        if pascal_case.match(node.name):
                            good += 1
                        else:
                            bad += 1
            except Exception:
                continue

        total = good + bad
        if total == 0:
            return 100.0

        ratio = good / total
        return round(ratio * 100, 1)
    
    def assess_documentation_coverage(self, files: List[Path]) -> float:
        """Assess documentation coverage"""
        documented_functions = 0
        total_functions = 0
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                tree = ast.parse(content)
                functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
                
                for func in functions:
                    total_functions += 1
                    if ast.get_docstring(func):
                        documented_functions += 1
            
            except Exception:
                continue
        
        if total_functions == 0:
            return 100.0
        
        coverage = (documented_functions / total_functions) * 100
        
        # Score based on coverage
        if coverage > 90:
            return 100.0
        elif coverage > 70:
            return 90.0 - (90 - coverage) * 0.5
        elif coverage > 50:
            return 70.0 - (70 - coverage) * 1.0
        else:
            return 50.0 - coverage
    
    def assess_typescript_complexity(self, files: List[Path]) -> float:
        """Assess TypeScript complexity"""
        # Simplified - would need TypeScript parser
        return 80.0  # Placeholder
    
    def assess_typescript_smells(self, files: List[Path]) -> float:
        """Assess TypeScript code smells"""
        large_files = 0
        total_files = len(files)
        
        for file_path in files:
            try:
                lines = len(file_path.read_text(encoding='utf-8').split('\n'))
                
                if lines > 1000:
                    large_files += 1
                    self.issues['code_quality'].append({
                        'file': str(file_path.relative_to(self.root_dir)),
                        'type': 'large_file',
                        'severity': 'high',
                        'message': f'TypeScript file has {lines} lines (>1000)',
                        'line': lines
                    })
            
            except Exception:
                continue
        
        if total_files == 0:
            return 100.0
        
        large_file_ratio = large_files / total_files
        
        if large_file_ratio < 0.05:
            return 100.0
        elif large_file_ratio < 0.10:
            return 90.0 - (large_file_ratio - 0.05) * 200
        else:
            return 70.0 - (large_file_ratio - 0.10) * 300
    
    def assess_security(self):
        """Assess security"""
        print("\n" + "=" * 100)
        print("ASSESSING SECURITY...")
        print("=" * 100)
        
        backend_dir = self.root_dir / 'backend'
        
        if backend_dir.exists():
            # Check for hardcoded secrets
            secrets_score = self.check_hardcoded_secrets(backend_dir)
            
            # Check for SQL injection risks
            sql_injection_score = self.check_sql_injection(backend_dir)
            
            # Check dependency vulnerabilities
            vuln_score = self.check_dependency_vulnerabilities(backend_dir)
            
            # Check authentication/authorization
            auth_score = self.check_authentication(backend_dir)
            
            self.results['security'] = {
                'secrets': secrets_score,
                'sql_injection': sql_injection_score,
                'vulnerabilities': vuln_score,
                'authentication': auth_score,
                'overall_score': self.calculate_weighted_score({
                    'secrets': 0.25,
                    'sql_injection': 0.20,
                    'vulnerabilities': 0.30,
                    'authentication': 0.25
                }, {
                    'secrets': secrets_score,
                    'sql_injection': sql_injection_score,
                    'vulnerabilities': vuln_score,
                    'authentication': auth_score
                }),
                'critical_issues': len([i for i in self.issues['security'] if i['severity'] == 'critical']),
                'high_issues': len([i for i in self.issues['security'] if i['severity'] == 'high'])
            }
        
        print(f"Security Score: {self.results['security'].get('overall_score', 0):.1f}/100")
    
    def check_hardcoded_secrets(self, backend_dir: Path) -> float:
        """Check for hardcoded secrets"""
        secret_patterns = [
            r'password\s*=\s*[\'"][^\'"]+[\'"]',
            r'secret\s*=\s*[\'"][^\'"]+[\'"]',
            r'key\s*=\s*[\'"][^\'"]+[\'"]',
            r'token\s*=\s*[\'"][^\'"]+[\'"]',
            r'api_key\s*=\s*[\'"][^\'"]+[\'"]'
        ]
        
        secrets_found = 0
        total_files = 0
        
        for file_path in backend_dir.rglob('*.py'):
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                
                total_files += 1
                
                for i, line in enumerate(lines, 1):
                    for pattern in secret_patterns:
                        if re.search(pattern, line, re.IGNORECASE):
                            # Check if it's using environment variable
                            if 'os.getenv' not in line and 'os.environ' not in line:
                                secrets_found += 1
                                self.issues['security'].append({
                                    'file': str(file_path.relative_to(self.root_dir)),
                                    'type': 'hardcoded_secret',
                                    'severity': 'high',
                                    'message': f'Possible hardcoded secret: {line.strip()[:50]}...',
                                    'line': i
                                })
                                break
            
            except Exception:
                continue
        
        if total_files == 0:
            return 100.0
        
        secret_ratio = secrets_found / total_files
        
        if secret_ratio == 0:
            return 100.0
        elif secret_ratio < 0.05:
            return 90.0 - secret_ratio * 200
        elif secret_ratio < 0.10:
            return 70.0 - (secret_ratio - 0.05) * 300
        else:
            return 40.0 - (secret_ratio - 0.10) * 400
    
    def check_sql_injection(self, backend_dir: Path) -> float:
        """Check for SQL injection risks"""
        risky_patterns = [
            r'execute\s*\(\s*f[\'"]',
            r'execute\s*\(\s*format\s*\(',
            r'execute\s*\(\s*\+.*sql'
        ]
        
        risky_count = 0
        total_files = 0
        
        for file_path in backend_dir.rglob('*.py'):
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                
                total_files += 1
                
                for i, line in enumerate(lines, 1):
                    for pattern in risky_patterns:
                        if re.search(pattern, line):
                            risky_count += 1
                            self.issues['security'].append({
                                'file': str(file_path.relative_to(self.root_dir)),
                                'type': 'sql_injection_risk',
                                'severity': 'critical',
                                'message': 'Possible SQL injection risk - use parameterized queries',
                                'line': i
                            })
                            break
            
            except Exception:
                continue
        
        if total_files == 0:
            return 100.0
        
        risky_ratio = risky_count / total_files
        
        if risky_ratio == 0:
            return 100.0
        elif risky_ratio < 0.02:
            return 90.0 - risky_ratio * 500
        elif risky_ratio < 0.05:
            return 70.0 - (risky_ratio - 0.02) * 500
        else:
            return 40.0 - (risky_ratio - 0.05) * 400
    
    def check_dependency_vulnerabilities(self, backend_dir: Path) -> float:
        """Check for dependency vulnerabilities using pip-audit"""
        req_file = backend_dir / 'requirements.txt'
        if not req_file.exists():
            return 75.0

        try:
            result = subprocess.run(
                ['pip-audit', '-r', str(req_file), '--format=json', '--no-progress-bar'],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                vuln_count = sum(len(pkg.get('vulns', [])) for pkg in data)
                if vuln_count == 0:
                    return 100.0
                elif vuln_count <= 2:
                    return 80.0
                elif vuln_count <= 5:
                    return 60.0
                else:
                    return max(0.0, 60.0 - (vuln_count - 5) * 5)
            else:
                # pip-audit not installed, fallback ke check requirements age
                return 75.0
        except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
            return 75.0
    
    def check_authentication(self, backend_dir: Path) -> float:
        """Check authentication implementation"""
        auth_file = backend_dir / 'routes' / 'auth.py'
        
        if not auth_file.exists():
            return 50.0
        
        try:
            content = auth_file.read_text(encoding='utf-8')
            
            # Check for JWT
            has_jwt = 'jwt' in content.lower()
            
            # Check for password hashing
            has_bcrypt = 'bcrypt' in content.lower()
            
            # Check for refresh token
            has_refresh = 'refresh' in content.lower()
            
            score = 50.0
            if has_jwt:
                score += 20.0
            if has_bcrypt:
                score += 20.0
            if has_refresh:
                score += 10.0
            
            return min(100.0, score)
        
        except Exception:
            return 50.0
    
    def assess_performance(self):
        """Assess performance"""
        print("\n" + "=" * 100)
        print("ASSESSING PERFORMANCE...")
        print("=" * 100)
        
        # Check for N+1 queries (simplified)
        nplus1_score = self.check_nplus1_queries()
        
        # Check for caching
        caching_score = self.check_caching_implementation()
        
        # Check for database indexes
        indexing_score = self.check_database_indexes()
        
        self.results['performance'] = {
            'nplus1_queries': nplus1_score,
            'caching': caching_score,
            'indexing': indexing_score,
            'overall_score': self.calculate_weighted_score({
                'nplus1_queries': 0.30,
                'caching': 0.40,
                'indexing': 0.30
            }, {
                'nplus1_queries': nplus1_score,
                'caching': caching_score,
                'indexing': indexing_score
            })
        }
        
        print(f"Performance Score: {self.results['performance']['overall_score']:.1f}/100")
    
    def check_nplus1_queries(self) -> float:
        """Detect potential N+1 query patterns — query inside a loop"""
        backend_dir = self.root_dir / 'backend'
        if not backend_dir.exists():
            return 70.0

        nplus1_count = 0
        files_checked = 0

        query_patterns = re.compile(
            r'\.(query|filter|filter_by|get|all|first|count|join)\s*[\(\.]'
        )
        loop_pattern = re.compile(r'^\s*(for |while )')

        for file_path in backend_dir.rglob('*.py'):
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            try:
                lines = file_path.read_text(encoding='utf-8').splitlines()
                files_checked += 1
                in_loop = False
                loop_indent = 0

                for i, line in enumerate(lines):
                    if loop_pattern.match(line):
                        in_loop = True
                        loop_indent = len(line) - len(line.lstrip())
                        continue

                    if in_loop:
                        current_indent = len(line) - len(line.lstrip()) if line.strip() else loop_indent + 1
                        if line.strip() and current_indent <= loop_indent:
                            in_loop = False
                        elif query_patterns.search(line):
                            nplus1_count += 1
                            self.issues['performance'].append({
                                'file': str(file_path.relative_to(self.root_dir)),
                                'type': 'potential_nplus1',
                                'severity': 'high',
                                'message': f'Possible N+1 query inside loop: {line.strip()[:60]}',
                                'line': i + 1
                            })
            except Exception:
                continue

        if files_checked == 0:
            return 70.0

        if nplus1_count == 0:
            return 100.0
        elif nplus1_count <= 3:
            return 85.0
        elif nplus1_count <= 10:
            return 70.0 - (nplus1_count - 3) * 3
        else:
            return max(0.0, 50.0 - (nplus1_count - 10) * 2)
    
    def check_caching_implementation(self) -> float:
        """Check caching implementation"""
        backend_dir = self.root_dir / 'backend'
        
        if not backend_dir.exists():
            return 50.0
        
        # Check for Redis and Flask-Caching in requirements.txt
        requirements_file = backend_dir / 'requirements.txt'
        has_redis = False
        has_flask_caching = False
        
        if requirements_file.exists():
            try:
                content = requirements_file.read_text(encoding='utf-8')
                has_redis = 'redis' in content.lower()
                has_flask_caching = 'flask-caching' in content.lower()
            except Exception:
                pass
        
        # Check for cache configuration in config.py
        config_file = backend_dir / 'config.py'
        has_redis_config = False
        
        if config_file.exists():
            try:
                content = config_file.read_text(encoding='utf-8')
                has_redis_config = 'REDIS_URL' in content or 'CACHE_TYPE' in content
            except Exception:
                pass
        
        # Check for cache initialization in app.py
        app_file = backend_dir / 'app.py'
        has_cache_init = False
        
        if app_file.exists():
            try:
                content = app_file.read_text(encoding='utf-8')
                has_cache_init = 'flask_caching' in content.lower() or 'Cache()' in content
            except Exception:
                pass
        
        # Check for cache usage in routes
        cache_usage = 0
        for file_path in backend_dir.rglob('*.py'):
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8')
                if 'cache.get' in content or 'cache.set' in content:
                    cache_usage += 1
            except Exception:
                continue
        
        # Calculate score based on implementation
        score = 50.0  # Base score
        
        if has_redis:
            score += 15.0
        if has_flask_caching:
            score += 15.0
        if has_redis_config:
            score += 10.0
        if has_cache_init:
            score += 10.0
        if cache_usage > 0:
            score += 10.0
        
        return min(score, 100.0)
    
    def check_database_indexes(self) -> float:
        """Check database indexes from SQLite and SQLAlchemy models"""
        import sqlite3

        # Try to find SQLite database
        db_paths = [
            self.root_dir / 'backend' / 'instance' / 'erp_database.db',
            self.root_dir / 'backend' / 'erp_database.db',
            self.root_dir / 'backend' / 'instance' / 'erp.db',
        ]

        db_path = next((p for p in db_paths if p.exists()), None)

        if db_path:
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()

                # Count indexes
                cursor.execute("""
                    SELECT COUNT(*) FROM sqlite_master
                    WHERE type='index' AND name NOT LIKE 'sqlite_%'
                """)
                index_count = cursor.fetchone()[0]

                # Count tables
                cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
                table_count = cursor.fetchone()[0]

                conn.close()

                if table_count == 0:
                    return 75.0

                ratio = index_count / table_count
                if ratio >= 3:
                    return 100.0
                elif ratio >= 2:
                    return 85.0
                elif ratio >= 1:
                    return 70.0
                else:
                    return 50.0
            except Exception:
                pass

        # Fallback: check SQLAlchemy models for Index definitions
        backend_dir = self.root_dir / 'backend'
        index_definitions = 0

        for file_path in (backend_dir / 'models').rglob('*.py') if (backend_dir / 'models').exists() else []:
            try:
                content = file_path.read_text(encoding='utf-8')
                index_definitions += content.count('db.Index(') + content.count('Index(') + content.count('index=True')
            except Exception:
                continue

        if index_definitions >= 10:
            return 90.0
        elif index_definitions >= 5:
            return 75.0
        elif index_definitions >= 1:
            return 60.0
        return 50.0
    
    def assess_architecture(self):
        """Assess architecture"""
        print("\n" + "=" * 100)
        print("ASSESSING ARCHITECTURE...")
        print("=" * 100)
        
        # Check for design patterns
        patterns_score = self.assess_design_patterns()
        
        # Check for module organization
        organization_score = self.assess_module_organization()
        
        # Check for coupling
        coupling_score = self.assess_module_coupling()
        
        self.results['architecture'] = {
            'design_patterns': patterns_score,
            'organization': organization_score,
            'coupling': coupling_score,
            'overall_score': self.calculate_weighted_score({
                'design_patterns': 0.30,
                'organization': 0.40,
                'coupling': 0.30
            }, {
                'design_patterns': patterns_score,
                'organization': organization_score,
                'coupling': coupling_score
            })
        }
        
        print(f"Architecture Score: {self.results['architecture']['overall_score']:.1f}/100")
    
    def assess_design_patterns(self) -> float:
        """Assess design pattern usage"""
        # Check for common patterns
        backend_dir = self.root_dir / 'backend'
        
        if not backend_dir.exists():
            return 50.0
        
        patterns_found = 0
        
        # Check for Blueprint pattern
        if (backend_dir / 'routes').exists():
            patterns_found += 1
        
        # Check for Repository pattern (models)
        if (backend_dir / 'models').exists():
            patterns_found += 1
        
        # Check for Factory pattern
        if (backend_dir / 'app.py').exists():
            patterns_found += 1
        
        # Check for Middleware pattern
        if (backend_dir / 'middleware').exists():
            patterns_found += 1
        
        return min(100.0, patterns_found * 25.0)
    
    def assess_module_organization(self) -> float:
        """Assess module organization"""
        backend_dir = self.root_dir / 'backend'
        frontend_dir = self.root_dir / 'frontend' / 'src'
        
        score = 50.0
        
        # Check backend organization
        if backend_dir.exists():
            expected_dirs = ['routes', 'models', 'utils', 'tests']
            found_dirs = sum(1 for d in expected_dirs if (backend_dir / d).exists())
            score += (found_dirs / len(expected_dirs)) * 25.0
        
        # Check frontend organization
        if frontend_dir.exists():
            expected_dirs = ['pages', 'components', 'services', 'store']
            found_dirs = sum(1 for d in expected_dirs if (frontend_dir / d).exists())
            score += (found_dirs / len(expected_dirs)) * 25.0
        
        return min(100.0, score)
    
    def assess_module_coupling(self) -> float:
        """Assess module coupling via import count per file"""
        backend_dir = self.root_dir / 'backend'
        if not backend_dir.exists():
            return 75.0

        import_counts = []
        import_pattern = re.compile(r'^\s*(import |from .+ import )')

        for file_path in backend_dir.rglob('*.py'):
            if '__pycache__' in str(file_path) or 'venv' in str(file_path):
                continue
            try:
                lines = file_path.read_text(encoding='utf-8').splitlines()
                count = sum(1 for l in lines if import_pattern.match(l))
                if count > 0:
                    import_counts.append(count)
            except Exception:
                continue

        if not import_counts:
            return 75.0

        avg_imports = sum(import_counts) / len(import_counts)
        high_coupling = sum(1 for c in import_counts if c > 20)
        high_ratio = high_coupling / len(import_counts)

        if avg_imports < 8 and high_ratio < 0.05:
            return 100.0
        elif avg_imports < 12 and high_ratio < 0.10:
            return 85.0
        elif avg_imports < 18 and high_ratio < 0.20:
            return 70.0
        elif avg_imports < 25:
            return 55.0
        else:
            return max(0.0, 40.0 - (avg_imports - 25) * 2)
    
    def assess_testing(self):
        """Assess testing"""
        print("\n" + "=" * 100)
        print("ASSESSING TESTING...")
        print("=" * 100)
        
        backend_dir = self.root_dir / 'backend'
        
        if backend_dir.exists():
            test_files = list(backend_dir.rglob('test_*.py'))
            test_dir = backend_dir / 'tests'
            if test_dir.exists():
                test_files.extend(list(test_dir.rglob('*.py')))

            total_files = len(test_files)

            # Try to get real coverage using pytest-cov
            coverage_score = self._get_real_coverage(backend_dir)

            self.results['testing'] = {
                'test_files': total_files,
                'coverage': coverage_score,
                'overall_score': coverage_score
            }
        
        print(f"Testing Score: {self.results['testing'].get('overall_score', 0):.1f}/100")
    
    def _get_real_coverage(self, backend_dir: Path) -> float:
        """Run pytest --cov and parse real coverage percentage"""
        try:
            result = subprocess.run(
                ['python', '-m', 'pytest', '--cov=.', '--cov-report=json',
                 '--tb=no', '-q', '--no-header'],
                capture_output=True, text=True,
                cwd=str(backend_dir), timeout=120
            )

            # Parse coverage.json
            cov_file = backend_dir / 'coverage.json'
            if cov_file.exists():
                data = json.loads(cov_file.read_text())
                pct = data.get('totals', {}).get('percent_covered', 0)
                # Convert coverage % to score
                if pct >= 90:
                    return 100.0
                elif pct >= 80:
                    return 90.0
                elif pct >= 70:
                    return 75.0
                elif pct >= 50:
                    return 55.0
                elif pct >= 30:
                    return 35.0
                else:
                    return max(0.0, pct)
        except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError, Exception):
            pass

        # Fallback: hitung rasio test files vs source files
        try:
            source_files = len([
                f for f in backend_dir.rglob('*.py')
                if '__pycache__' not in str(f)
                and 'venv' not in str(f)
                and 'test_' not in f.name
                and f.name != 'conftest.py'
            ])
            test_files = len([
                f for f in backend_dir.rglob('test_*.py')
                if '__pycache__' not in str(f)
            ])
            if source_files == 0:
                return 55.0
            ratio = test_files / source_files
            return min(70.0, ratio * 100)
        except Exception:
            return 55.0

    def assess_documentation(self):
        """Assess documentation"""
        print("\n" + "=" * 100)
        print("ASSESSING DOCUMENTATION...")
        print("=" * 100)
        
        # Check for README
        readme_score = 0.0
        if (self.root_dir / 'README.md').exists():
            readme_score = 90.0
        
        # Check for API documentation (Swagger/OpenAPI/docstrings di routes)
        api_docs_score = self._check_api_docs()
        
        self.results['documentation'] = {
            'readme': readme_score,
            'api_docs': api_docs_score,
            'overall_score': self.calculate_weighted_score({
                'readme': 0.40,
                'api_docs': 0.60
            }, {
                'readme': readme_score,
                'api_docs': api_docs_score
            })
        }
        
        print(f"Documentation Score: {self.results['documentation']['overall_score']:.1f}/100")
    
    def _check_api_docs(self) -> float:
        """Check API documentation coverage in route files"""
        backend_dir = self.root_dir / 'backend' / 'routes'
        if not backend_dir.exists():
            return 50.0

        documented = 0
        total = 0

        for file_path in backend_dir.rglob('*.py'):
            try:
                content = file_path.read_text(encoding='utf-8')
                tree = ast.parse(content)

                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        # Cek apakah ini route handler (ada decorator @...route)
                        is_route = any(
                            isinstance(d, ast.Call) and 'route' in ast.dump(d)
                            for d in node.decorator_list
                        )
                        if is_route:
                            total += 1
                            if ast.get_docstring(node):
                                documented += 1
            except Exception:
                continue

        if total == 0:
            return 50.0

        ratio = documented / total
        if ratio >= 0.90:
            return 100.0
        elif ratio >= 0.70:
            return 85.0
        elif ratio >= 0.50:
            return 70.0
        elif ratio >= 0.30:
            return 55.0
        else:
            return max(20.0, ratio * 100)

    def calculate_weighted_score(self, weights: Dict[str, float], scores: Dict[str, float]) -> float:
        """Calculate weighted score"""
        total = 0.0
        for key, weight in weights.items():
            total += weight * scores.get(key, 0.0)
        return total
    
    def calculate_overall_score(self):
        """Calculate overall assessment score"""
        weights = {
            'code_quality': 0.25,
            'security': 0.25,
            'performance': 0.20,
            'architecture': 0.15,
            'testing': 0.10,
            'documentation': 0.05
        }
        
        scores = {
            'code_quality': self.results['code_quality'].get('overall_score', 0),
            'security': self.results['security'].get('overall_score', 0),
            'performance': self.results['performance'].get('overall_score', 0),
            'architecture': self.results['architecture'].get('overall_score', 0),
            'testing': self.results['testing'].get('overall_score', 0),
            'documentation': self.results['documentation'].get('overall_score', 0)
        }
        
        overall_score = self.calculate_weighted_score(weights, scores)
        self.results['overall_score'] = overall_score
        
        # Determine grade
        if overall_score >= 90:
            self.results['grade'] = 'A+'
            self.results['risk_level'] = 'Low'
        elif overall_score >= 85:
            self.results['grade'] = 'A'
            self.results['risk_level'] = 'Low-Medium'
        elif overall_score >= 80:
            self.results['grade'] = 'B+'
            self.results['risk_level'] = 'Low-Medium'
        elif overall_score >= 75:
            self.results['grade'] = 'B'
            self.results['risk_level'] = 'Medium'
        elif overall_score >= 70:
            self.results['grade'] = 'C+'
            self.results['risk_level'] = 'Medium'
        elif overall_score >= 60:
            self.results['grade'] = 'C'
            self.results['risk_level'] = 'High'
        else:
            self.results['grade'] = 'F'
            self.results['risk_level'] = 'Critical'
        
        print("\n" + "=" * 100)
        print("OVERALL ASSESSMENT RESULTS")
        print("=" * 100)
        print(f"Overall Score: {overall_score:.1f}/100")
        print(f"Grade: {self.results['grade']}")
        print(f"Risk Level: {self.results['risk_level']}")
        print("=" * 100)
    
    def generate_report(self):
        """Generate comprehensive assessment report"""
        # Report disimpan di /home/superadmin/SourceCode/docs/
        report_path = Path('/home/superadmin/SourceCode/docs/ASSESSMENT_REPORT.md')
        report_path.parent.mkdir(parents=True, exist_ok=True)

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("# 🎯 ERP SYSTEM ASSESSMENT REPORT\n\n")
            f.write(f"**Assessment Date:** {self.results['metadata']['assessment_date']}\n")
            f.write(f"**Root Directory:** {self.results['metadata']['root_directory']}\n")
            f.write(f"**Assessment Version:** {self.results['metadata']['version']}\n\n")
            
            f.write("---\n\n")
            
            f.write("## 📊 EXECUTIVE SUMMARY\n\n")
            f.write(f"### Overall Score: {self.results['overall_score']:.1f}/100\n\n")
            f.write(f"### Grade: {self.results['grade']}\n\n")
            f.write(f"### Risk Level: {self.results['risk_level']}\n\n")
            
            f.write("---\n\n")
            
            f.write("## 📋 DETAILED ASSESSMENT RESULTS\n\n")
            
            # Code Quality
            f.write("### 1. Code Quality Assessment\n\n")
            cq = self.results.get('code_quality', {})
            f.write(f"**Overall Score:** {cq.get('overall_score', 0):.1f}/100\n\n")
            f.write(f"- **Complexity:** {cq.get('complexity', 0):.1f}/100\n")
            f.write(f"- **Duplication:** {cq.get('duplication', 0):.1f}/100\n")
            f.write(f"- **Code Smells:** {cq.get('code_smells', 0):.1f}/100\n")
            f.write(f"- **Naming Convention:** {cq.get('naming', 0):.1f}/100\n")
            f.write(f"- **Documentation:** {cq.get('documentation', 0):.1f}/100\n")
            f.write(f"- **Files Analyzed:** {cq.get('files_analyzed', 0)}\n")
            f.write(f"- **Critical/High Issues:** {cq.get('issues', 0)}\n\n")
            
            # Security
            f.write("### 2. Security Assessment\n\n")
            sec = self.results.get('security', {})
            f.write(f"**Overall Score:** {sec.get('overall_score', 0):.1f}/100\n\n")
            f.write(f"- **Secrets Management:** {sec.get('secrets', 0):.1f}/100\n")
            f.write(f"- **SQL Injection Prevention:** {sec.get('sql_injection', 0):.1f}/100\n")
            f.write(f"- **Dependency Vulnerabilities:** {sec.get('vulnerabilities', 0):.1f}/100\n")
            f.write(f"- **Authentication:** {sec.get('authentication', 0):.1f}/100\n")
            f.write(f"- **Critical Issues:** {sec.get('critical_issues', 0)}\n")
            f.write(f"- **High Issues:** {sec.get('high_issues', 0)}\n\n")
            
            # Performance
            f.write("### 3. Performance Assessment\n\n")
            perf = self.results.get('performance', {})
            f.write(f"**Overall Score:** {perf.get('overall_score', 0):.1f}/100\n\n")
            f.write(f"- **N+1 Query Prevention:** {perf.get('nplus1_queries', 0):.1f}/100\n")
            f.write(f"- **Caching Implementation:** {perf.get('caching', 0):.1f}/100\n")
            f.write(f"- **Database Indexing:** {perf.get('indexing', 0):.1f}/100\n\n")
            
            # Architecture
            f.write("### 4. Architecture Assessment\n\n")
            arch = self.results.get('architecture', {})
            f.write(f"**Overall Score:** {arch.get('overall_score', 0):.1f}/100\n\n")
            f.write(f"- **Design Patterns:** {arch.get('design_patterns', 0):.1f}/100\n")
            f.write(f"- **Module Organization:** {arch.get('organization', 0):.1f}/100\n")
            f.write(f"- **Module Coupling:** {arch.get('coupling', 0):.1f}/100\n\n")
            
            # Testing
            f.write("### 5. Testing Assessment\n\n")
            test = self.results.get('testing', {})
            f.write(f"**Overall Score:** {test.get('overall_score', 0):.1f}/100\n\n")
            f.write(f"- **Test Coverage:** {test.get('coverage', 0):.1f}/100\n")
            f.write(f"- **Test Files:** {test.get('test_files', 0)}\n\n")
            
            # Documentation
            f.write("### 6. Documentation Assessment\n\n")
            doc = self.results.get('documentation', {})
            f.write(f"**Overall Score:** {doc.get('overall_score', 0):.1f}/100\n\n")
            f.write(f"- **README:** {doc.get('readme', 0):.1f}/100\n")
            f.write(f"- **API Documentation:** {doc.get('api_docs', 0):.1f}/100\n\n")
            
            f.write("---\n\n")
            
            f.write("## 🚨 CRITICAL ISSUES\n\n")
            
            critical_issues = [i for i in self.issues['security'] if i['severity'] == 'critical']
            if critical_issues:
                for issue in critical_issues[:20]:  # Limit to top 20
                    f.write(f"### {issue['type']}\n")
                    f.write(f"- **File:** {issue['file']}\n")
                    f.write(f"- **Line:** {issue['line']}\n")
                    f.write(f"- **Message:** {issue['message']}\n\n")
            else:
                f.write("No critical issues found.\n\n")
            
            f.write("---\n\n")
            
            f.write("## 📈 RECOMMENDATIONS\n\n")
            
            f.write("### High Priority\n\n")
            
            # Generate recommendations based on scores
            if self.results['security'].get('overall_score', 0) < 80:
                f.write("- **Security:** Address security vulnerabilities immediately\n")
                f.write("  - Remove hardcoded secrets\n")
                f.write("  - Fix SQL injection risks\n")
                f.write("  - Update vulnerable dependencies\n\n")
            
            if self.results['code_quality'].get('overall_score', 0) < 80:
                f.write("- **Code Quality:** Refactor large files and reduce complexity\n")
                f.write("  - Split files > 1000 lines\n")
                f.write("  - Reduce function complexity\n")
                f.write("  - Improve documentation coverage\n\n")
            
            if self.results['performance'].get('overall_score', 0) < 80:
                f.write("- **Performance:** Implement caching and optimize queries\n")
                f.write("  - Add Redis caching\n")
                f.write("  - Fix N+1 query problems\n")
                f.write("  - Add database indexes\n\n")
            
            f.write("---\n\n")
            f.write("*Report generated by ERP Assessment System v1.0.0*\n")
        
        print(f"\nAssessment report generated: {report_path}")


def main():
    """Main entry point"""
    import sys
    
    if len(sys.argv) > 1:
        root_dir = sys.argv[1]
    else:
        root_dir = '/home/superadmin/SourceCode'
    
    assessor = AssessmentSystem(root_dir)
    assessor.run_full_assessment()


if __name__ == '__main__':
    main()
