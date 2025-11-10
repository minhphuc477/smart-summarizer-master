# Run embedding backfill after dimension migration
# This regenerates all embeddings with the new 384-dimension vectors

Write-Host "Starting embedding backfill..." -ForegroundColor Cyan
Write-Host ""

# Check if server is running
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    Write-Host "Server is running" -ForegroundColor Green
} catch {
    Write-Host "Dev server not running. Please start with: npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Running backfill (this may take a while for large datasets)..." -ForegroundColor Yellow
Write-Host ""

# Run backfill
try {
    # Include x-service-role header when SUPABASE_SERVICE_ROLE_KEY is available in environment or .env.local
    $headers = @{ 'Content-Type' = 'application/json' }
    if (-not $env:SUPABASE_SERVICE_ROLE_KEY -and (Test-Path -Path '.env.local')) {
        $kv = Select-String -Path '.env.local' -Pattern '^SUPABASE_SERVICE_ROLE_KEY' -ErrorAction SilentlyContinue
        if ($kv) {
            $val = $kv.Line.Split('=')[1].Trim().Trim('"')
            if ($val) { $env:SUPABASE_SERVICE_ROLE_KEY = $val }
        }
    }
    if ($env:SUPABASE_SERVICE_ROLE_KEY) {
        Write-Host "Using SUPABASE_SERVICE_ROLE_KEY from environment/.env.local" -ForegroundColor Cyan
        $headers['x-service-role'] = $env:SUPABASE_SERVICE_ROLE_KEY
    } else {
        Write-Host "No SUPABASE_SERVICE_ROLE_KEY found; sending request without service-role header" -ForegroundColor Yellow
    }

    # Build request body. Optionally accept a user id as first script argument.
    $bodyObj = @{ limit = 100 }
    if ($args.Count -gt 0 -and $args[0]) {
        $bodyObj['user_id'] = $args[0]
        Write-Host "Including user_id: $($args[0])" -ForegroundColor Cyan
    }

    # Use Invoke-WebRequest to capture raw status code and body for better diagnostics
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/admin/backfill-embeddings" `
        -Method POST `
        -Headers $headers `
        -Body ($bodyObj | ConvertTo-Json -Compress) `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "Response status: $($resp.StatusCode)" -ForegroundColor Cyan
    if ($resp.Content -and $resp.Content.Trim().Length -gt 0) {
        try {
            $parsed = $resp.Content | ConvertFrom-Json -ErrorAction Stop
            Write-Host "Response JSON:" -ForegroundColor Cyan
            $parsed | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
            Write-Host "Response body (raw):" -ForegroundColor Cyan
            $resp.Content | Write-Host
        }
    } else {
        Write-Host "Response body: (empty)" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "Backfill request completed" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try { $text = $_.Exception.Response.Content | ConvertFrom-Json; Write-Host "Response body:" -ForegroundColor Red; $text | ConvertTo-Json -Depth 10 | Write-Host } catch { }
    }
}

Write-Host ""
Write-Host "Backfill script finished." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test semantic search in the UI"
Write-Host "2. Search for any query - should show % similarity scores"
Write-Host "3. The keyword-match fallback should no longer appear"
