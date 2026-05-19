# PowerShell script to comprehensively add dark mode classes
# This handles ALL white elements including inputs, selects, tables, modals, etc.

Write-Host "Adding COMPREHENSIVE dark mode classes..." -ForegroundColor Cyan
Write-Host "This will handle inputs, selects, tables, modals, cards, and more" -ForegroundColor Yellow
Write-Host ""

$files = Get-ChildItem -Path "frontend/src" -Filter "*.tsx" -Recurse
$totalFiles = 0
$totalChanges = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $changes = 0
    
    # ============ BACKGROUNDS ============
    
    # bg-white (most common white background)
    if ($content -match 'className="[^"]*\bbg-white\b[^"]*"' -and $content -notmatch 'bg-white[^"]*dark:bg-gray-[78]') {
        $content = $content -replace '(className="[^"]*\b)(bg-white)(\b[^"]*")', '$1$2 dark:bg-gray-800$3'
        $changes++
    }
    
    # bg-gray-50
    if ($content -match 'className="[^"]*\bbg-gray-50\b[^"]*"' -and $content -notmatch 'bg-gray-50[^"]*dark:bg-gray-9') {
        $content = $content -replace '(className="[^"]*\b)(bg-gray-50)(\b[^"]*")', '$1$2 dark:bg-gray-900$3'
        $changes++
    }
    
    # bg-gray-100
    if ($content -match 'className="[^"]*\bbg-gray-100\b[^"]*"' -and $content -notmatch 'bg-gray-100[^"]*dark:bg-gray-[78]') {
        $content = $content -replace '(className="[^"]*\b)(bg-gray-100)(\b[^"]*")', '$1$2 dark:bg-gray-800$3'
        $changes++
    }
    
    # bg-gray-200
    if ($content -match 'className="[^"]*\bbg-gray-200\b[^"]*"' -and $content -notmatch 'bg-gray-200[^"]*dark:bg-gray-7') {
        $content = $content -replace '(className="[^"]*\b)(bg-gray-200)(\b[^"]*")', '$1$2 dark:bg-gray-700$3'
        $changes++
    }
    
    # ============ TEXT COLORS ============
    
    # text-gray-900 (darkest text)
    if ($content -match 'className="[^"]*\btext-gray-900\b[^"]*"' -and $content -notmatch 'text-gray-900[^"]*dark:text-') {
        $content = $content -replace '(className="[^"]*\b)(text-gray-900)(\b[^"]*")', '$1$2 dark:text-white$3'
        $changes++
    }
    
    # text-gray-800
    if ($content -match 'className="[^"]*\btext-gray-800\b[^"]*"' -and $content -notmatch 'text-gray-800[^"]*dark:text-') {
        $content = $content -replace '(className="[^"]*\b)(text-gray-800)(\b[^"]*")', '$1$2 dark:text-gray-100$3'
        $changes++
    }
    
    # text-gray-700
    if ($content -match 'className="[^"]*\btext-gray-700\b[^"]*"' -and $content -notmatch 'text-gray-700[^"]*dark:text-') {
        $content = $content -replace '(className="[^"]*\b)(text-gray-700)(\b[^"]*")', '$1$2 dark:text-gray-200$3'
        $changes++
    }
    
    # text-gray-600
    if ($content -match 'className="[^"]*\btext-gray-600\b[^"]*"' -and $content -notmatch 'text-gray-600[^"]*dark:text-') {
        $content = $content -replace '(className="[^"]*\b)(text-gray-600)(\b[^"]*")', '$1$2 dark:text-gray-300$3'
        $changes++
    }
    
    # text-gray-500
    if ($content -match 'className="[^"]*\btext-gray-500\b[^"]*"' -and $content -notmatch 'text-gray-500[^"]*dark:text-') {
        $content = $content -replace '(className="[^"]*\b)(text-gray-500)(\b[^"]*")', '$1$2 dark:text-gray-400$3'
        $changes++
    }
    
    # text-black
    if ($content -match 'className="[^"]*\btext-black\b[^"]*"' -and $content -notmatch 'text-black[^"]*dark:text-') {
        $content = $content -replace '(className="[^"]*\b)(text-black)(\b[^"]*")', '$1$2 dark:text-white$3'
        $changes++
    }
    
    # ============ BORDERS ============
    
    # border-gray-200
    if ($content -match 'className="[^"]*\bborder-gray-200\b[^"]*"' -and $content -notmatch 'border-gray-200[^"]*dark:border-') {
        $content = $content -replace '(className="[^"]*\b)(border-gray-200)(\b[^"]*")', '$1$2 dark:border-gray-700$3'
        $changes++
    }
    
    # border-gray-300
    if ($content -match 'className="[^"]*\bborder-gray-300\b[^"]*"' -and $content -notmatch 'border-gray-300[^"]*dark:border-') {
        $content = $content -replace '(className="[^"]*\b)(border-gray-300)(\b[^"]*")', '$1$2 dark:border-gray-600$3'
        $changes++
    }
    
    # divide-gray-200
    if ($content -match 'className="[^"]*\bdivide-gray-200\b[^"]*"' -and $content -notmatch 'divide-gray-200[^"]*dark:divide-') {
        $content = $content -replace '(className="[^"]*\b)(divide-gray-200)(\b[^"]*")', '$1$2 dark:divide-gray-700$3'
        $changes++
    }
    
    # divide-gray-300
    if ($content -match 'className="[^"]*\bdivide-gray-300\b[^"]*"' -and $content -notmatch 'divide-gray-300[^"]*dark:divide-') {
        $content = $content -replace '(className="[^"]*\b)(divide-gray-300)(\b[^"]*")', '$1$2 dark:divide-gray-600$3'
        $changes++
    }
    
    # ============ HOVER STATES ============
    
    # hover:bg-gray-50
    if ($content -match 'className="[^"]*\bhover:bg-gray-50\b[^"]*"' -and $content -notmatch 'hover:bg-gray-50[^"]*dark:hover:bg-') {
        $content = $content -replace '(className="[^"]*\b)(hover:bg-gray-50)(\b[^"]*")', '$1$2 dark:hover:bg-gray-700$3'
        $changes++
    }
    
    # hover:bg-gray-100
    if ($content -match 'className="[^"]*\bhover:bg-gray-100\b[^"]*"' -and $content -notmatch 'hover:bg-gray-100[^"]*dark:hover:bg-') {
        $content = $content -replace '(className="[^"]*\b)(hover:bg-gray-100)(\b[^"]*")', '$1$2 dark:hover:bg-gray-700$3'
        $changes++
    }
    
    # hover:bg-white
    if ($content -match 'className="[^"]*\bhover:bg-white\b[^"]*"' -and $content -notmatch 'hover:bg-white[^"]*dark:hover:bg-') {
        $content = $content -replace '(className="[^"]*\b)(hover:bg-white)(\b[^"]*")', '$1$2 dark:hover:bg-gray-700$3'
        $changes++
    }
    
    # ============ FOCUS STATES ============
    
    # focus:bg-white
    if ($content -match 'className="[^"]*\bfocus:bg-white\b[^"]*"' -and $content -notmatch 'focus:bg-white[^"]*dark:focus:bg-') {
        $content = $content -replace '(className="[^"]*\b)(focus:bg-white)(\b[^"]*")', '$1$2 dark:focus:bg-gray-800$3'
        $changes++
    }
    
    # focus:border-gray-300
    if ($content -match 'className="[^"]*\bfocus:border-gray-300\b[^"]*"' -and $content -notmatch 'focus:border-gray-300[^"]*dark:focus:border-') {
        $content = $content -replace '(className="[^"]*\b)(focus:border-gray-300)(\b[^"]*")', '$1$2 dark:focus:border-gray-600$3'
        $changes++
    }
    
    # ============ RING COLORS ============
    
    # ring-gray-200
    if ($content -match 'className="[^"]*\bring-gray-200\b[^"]*"' -and $content -notmatch 'ring-gray-200[^"]*dark:ring-') {
        $content = $content -replace '(className="[^"]*\b)(ring-gray-200)(\b[^"]*")', '$1$2 dark:ring-gray-700$3'
        $changes++
    }
    
    # ring-gray-300
    if ($content -match 'className="[^"]*\bring-gray-300\b[^"]*"' -and $content -notmatch 'ring-gray-300[^"]*dark:ring-') {
        $content = $content -replace '(className="[^"]*\b)(ring-gray-300)(\b[^"]*")', '$1$2 dark:ring-gray-600$3'
        $changes++
    }
    
    # ============ PLACEHOLDER ============
    
    # placeholder-gray-400
    if ($content -match 'className="[^"]*\bplaceholder-gray-400\b[^"]*"' -and $content -notmatch 'placeholder-gray-400[^"]*dark:placeholder-') {
        $content = $content -replace '(className="[^"]*\b)(placeholder-gray-400)(\b[^"]*")', '$1$2 dark:placeholder-gray-500$3'
        $changes++
    }
    
    # placeholder-gray-500
    if ($content -match 'className="[^"]*\bplaceholder-gray-500\b[^"]*"' -and $content -notmatch 'placeholder-gray-500[^"]*dark:placeholder-') {
        $content = $content -replace '(className="[^"]*\b)(placeholder-gray-500)(\b[^"]*")', '$1$2 dark:placeholder-gray-400$3'
        $changes++
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalFiles++
        $totalChanges += $changes
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "[OK] $relativePath - $changes changes" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPREHENSIVE DARK MODE UPDATE COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Files updated: $totalFiles" -ForegroundColor Green
Write-Host "  Total changes: $totalChanges" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[+] Backgrounds (white, gray-50, gray-100, gray-200)" -ForegroundColor Yellow
Write-Host "[+] Text colors (gray-900 to gray-500, black)" -ForegroundColor Yellow
Write-Host "[+] Borders (gray-200, gray-300)" -ForegroundColor Yellow
Write-Host "[+] Hover states (bg-gray-50, bg-gray-100, bg-white)" -ForegroundColor Yellow
Write-Host "[+] Focus states (bg-white, border-gray-300)" -ForegroundColor Yellow
Write-Host "[+] Ring colors (gray-200, gray-300)" -ForegroundColor Yellow
Write-Host "[+] Placeholders (gray-400, gray-500)" -ForegroundColor Yellow
Write-Host ""
Write-Host "NEXT: Restart dev server and test all pages!" -ForegroundColor Cyan
