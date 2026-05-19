# PowerShell script to add dark mode classes to ALL page TSX files
# Usage: .\add-dark-mode-all.ps1

Write-Host "Adding dark mode classes to ALL pages..." -ForegroundColor Cyan
Write-Host "This will modify files in frontend/src/pages/" -ForegroundColor Yellow
Write-Host ""

$files = Get-ChildItem -Path "frontend/src/pages" -Filter "*.tsx" -Recurse
$totalFiles = 0
$totalChanges = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $changes = 0
    
    # bg-white -> bg-white dark:bg-gray-800
    if ($content -match 'className="[^"]*bg-white[^"]*"' -and $content -notmatch 'bg-white[^"]*dark:bg') {
        $content = $content -replace '(className="[^"]*)(bg-white)([^"]*")', '$1$2 dark:bg-gray-800$3'
        $changes++
    }
    
    # bg-gray-50 -> bg-gray-50 dark:bg-gray-900
    if ($content -match 'className="[^"]*bg-gray-50[^"]*"' -and $content -notmatch 'bg-gray-50[^"]*dark:bg') {
        $content = $content -replace '(className="[^"]*)(bg-gray-50)([^"]*")', '$1$2 dark:bg-gray-900$3'
        $changes++
    }
    
    # bg-gray-100 -> bg-gray-100 dark:bg-gray-800
    if ($content -match 'className="[^"]*bg-gray-100[^"]*"' -and $content -notmatch 'bg-gray-100[^"]*dark:bg') {
        $content = $content -replace '(className="[^"]*)(bg-gray-100)([^"]*")', '$1$2 dark:bg-gray-800$3'
        $changes++
    }
    
    # bg-gray-200 -> bg-gray-200 dark:bg-gray-700
    if ($content -match 'className="[^"]*bg-gray-200[^"]*"' -and $content -notmatch 'bg-gray-200[^"]*dark:bg') {
        $content = $content -replace '(className="[^"]*)(bg-gray-200)([^"]*")', '$1$2 dark:bg-gray-700$3'
        $changes++
    }
    
    # text-gray-900 -> text-gray-900 dark:text-white
    if ($content -match 'className="[^"]*text-gray-900[^"]*"' -and $content -notmatch 'text-gray-900[^"]*dark:text') {
        $content = $content -replace '(className="[^"]*)(text-gray-900)([^"]*")', '$1$2 dark:text-white$3'
        $changes++
    }
    
    # text-gray-800 -> text-gray-800 dark:text-gray-100
    if ($content -match 'className="[^"]*text-gray-800[^"]*"' -and $content -notmatch 'text-gray-800[^"]*dark:text') {
        $content = $content -replace '(className="[^"]*)(text-gray-800)([^"]*")', '$1$2 dark:text-gray-100$3'
        $changes++
    }
    
    # text-gray-700 -> text-gray-700 dark:text-gray-200
    if ($content -match 'className="[^"]*text-gray-700[^"]*"' -and $content -notmatch 'text-gray-700[^"]*dark:text') {
        $content = $content -replace '(className="[^"]*)(text-gray-700)([^"]*")', '$1$2 dark:text-gray-200$3'
        $changes++
    }
    
    # text-gray-600 -> text-gray-600 dark:text-gray-300
    if ($content -match 'className="[^"]*text-gray-600[^"]*"' -and $content -notmatch 'text-gray-600[^"]*dark:text') {
        $content = $content -replace '(className="[^"]*)(text-gray-600)([^"]*")', '$1$2 dark:text-gray-300$3'
        $changes++
    }
    
    # text-gray-500 -> text-gray-500 dark:text-gray-400
    if ($content -match 'className="[^"]*text-gray-500[^"]*"' -and $content -notmatch 'text-gray-500[^"]*dark:text') {
        $content = $content -replace '(className="[^"]*)(text-gray-500)([^"]*")', '$1$2 dark:text-gray-400$3'
        $changes++
    }
    
    # border-gray-200 -> border-gray-200 dark:border-gray-700
    if ($content -match 'className="[^"]*border-gray-200[^"]*"' -and $content -notmatch 'border-gray-200[^"]*dark:border') {
        $content = $content -replace '(className="[^"]*)(border-gray-200)([^"]*")', '$1$2 dark:border-gray-700$3'
        $changes++
    }
    
    # border-gray-300 -> border-gray-300 dark:border-gray-600
    if ($content -match 'className="[^"]*border-gray-300[^"]*"' -and $content -notmatch 'border-gray-300[^"]*dark:border') {
        $content = $content -replace '(className="[^"]*)(border-gray-300)([^"]*")', '$1$2 dark:border-gray-600$3'
        $changes++
    }
    
    # divide-gray-200 -> divide-gray-200 dark:divide-gray-700
    if ($content -match 'className="[^"]*divide-gray-200[^"]*"' -and $content -notmatch 'divide-gray-200[^"]*dark:divide') {
        $content = $content -replace '(className="[^"]*)(divide-gray-200)([^"]*")', '$1$2 dark:divide-gray-700$3'
        $changes++
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalFiles++
        $totalChanges += $changes
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "Updated: $relativePath - $changes changes" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Files updated: $totalFiles" -ForegroundColor Green
Write-Host "  Total changes: $totalChanges" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Done! Please test all pages in dark mode." -ForegroundColor Yellow
Write-Host "Recommended: Restart your dev server to see changes." -ForegroundColor Yellow
