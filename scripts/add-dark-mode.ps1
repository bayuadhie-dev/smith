# PowerShell script to add dark mode classes to TSX files
# Usage: .\add-dark-mode.ps1

$files = Get-ChildItem -Path "frontend/src/pages" -Filter "*.tsx" -Recurse

$replacements = @(
    # Background colors
    @{Pattern = 'className="([^"]*?)bg-white([^"]*?)"'; Replacement = 'className="$1bg-white dark:bg-gray-800$2"'},
    @{Pattern = 'className="([^"]*?)bg-gray-50([^"]*?)"'; Replacement = 'className="$1bg-gray-50 dark:bg-gray-900$2"'},
    @{Pattern = 'className="([^"]*?)bg-gray-100([^"]*?)"'; Replacement = 'className="$1bg-gray-100 dark:bg-gray-800$2"'},
    @{Pattern = 'className="([^"]*?)bg-gray-200([^"]*?)"'; Replacement = 'className="$1bg-gray-200 dark:bg-gray-700$2"'},
    
    # Text colors
    @{Pattern = 'className="([^"]*?)text-gray-900([^"]*?)"'; Replacement = 'className="$1text-gray-900 dark:text-white$2"'},
    @{Pattern = 'className="([^"]*?)text-gray-800([^"]*?)"'; Replacement = 'className="$1text-gray-800 dark:text-gray-100$2"'},
    @{Pattern = 'className="([^"]*?)text-gray-700([^"]*?)"'; Replacement = 'className="$1text-gray-700 dark:text-gray-200$2"'},
    @{Pattern = 'className="([^"]*?)text-gray-600([^"]*?)"'; Replacement = 'className="$1text-gray-600 dark:text-gray-300$2"'},
    @{Pattern = 'className="([^"]*?)text-gray-500([^"]*?)"'; Replacement = 'className="$1text-gray-500 dark:text-gray-400$2"'},
    
    # Borders
    @{Pattern = 'className="([^"]*?)border-gray-200([^"]*?)"'; Replacement = 'className="$1border-gray-200 dark:border-gray-700$2"'},
    @{Pattern = 'className="([^"]*?)border-gray-300([^"]*?)"'; Replacement = 'className="$1border-gray-300 dark:border-gray-600$2"'},
    @{Pattern = 'className="([^"]*?)divide-gray-200([^"]*?)"'; Replacement = 'className="$1divide-gray-200 dark:divide-gray-700$2"'}
)

$totalFiles = 0
$totalReplacements = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $fileReplacements = 0
    
    foreach ($replacement in $replacements) {
        # Skip if already has dark: class
        if ($content -match $replacement.Pattern -and $content -notmatch "dark:") {
            $newContent = $content -replace $replacement.Pattern, $replacement.Replacement
            if ($newContent -ne $content) {
                $content = $newContent
                $fileReplacements++
            }
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalFiles++
        $totalReplacements += $fileReplacements
        Write-Host "Updated: $($file.Name) ($fileReplacements replacements)" -ForegroundColor Green
    }
}

Write-Host "`nTotal files updated: $totalFiles" -ForegroundColor Cyan
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Cyan
Write-Host "`nDone! Please review the changes and test your application." -ForegroundColor Yellow
