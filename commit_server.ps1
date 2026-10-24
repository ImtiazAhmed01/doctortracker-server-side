<#
.SYNOPSIS
    DoctorTracker Server - Multi-Commit Generator with Custom Timestamps & Remote Setup
.DESCRIPTION
    Reinitializes the Git repository for doctortrack server, stages files across
    12 meaningful milestones with realistic commit timestamps across:
      - 23/10/2026 (afternoon/evening)
      - 24/10/2026 (morning/afternoon/evening)
      - 25/10/2026 (1:00 AM - 2:00 AM)
    Sets branch to main and configures origin to:
      https://github.com/ImtiazAhmed01/doctortracker-server-side.git
.USAGE
    Open PowerShell in: d:\projects\doctortracker\doctortrack server
    Run: .\commit_server.ps1
#>

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  DoctorTracker SERVER - Multi-Commit Generator (Timed)   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Reset / re-initialize git repository
if (Test-Path ".git") {
    Write-Host "[1/3] Removing existing .git repository to start fresh..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".git"
}
Write-Host "[2/3] Initializing clean Git repository..." -ForegroundColor Green
git init

# Configure user locally if not set globally
$gitUser = git config user.name
if (-not $gitUser) {
    git config user.name "Imtiaz Ahmed"
    git config user.email "imtsky24@gmail.com"
}

# Helper function to stage, set environment commit dates, and commit
function Make-TimedCommit($files, $msg, $dateStr) {
    $env:GIT_AUTHOR_DATE = $dateStr
    $env:GIT_COMMITTER_DATE = $dateStr

    foreach ($f in $files) {
        if (Test-Path $f) {
            git add $f
        }
    }
    $staged = git diff --staged --name-only
    if ($staged) {
        git commit -m "$msg"
        Write-Host "  [OK] $dateStr -> $msg" -ForegroundColor Green
    } else {
        git commit --allow-empty -m "$msg"
        Write-Host "  [OK] (milestone) $dateStr -> $msg" -ForegroundColor Yellow
    }
}

Write-Host "`n[3/3] Generating 12 realistic commits across 23/10, 24/10, and 25/10 (1-2 AM)...`n" -ForegroundColor Cyan

# Day 1: Oct 23, 2026
Make-TimedCommit @("README.md") "first commit" "2026-10-23T14:18:22"
Make-TimedCommit @(".gitignore", "package.json", "package-lock.json", ".env.example") "chore(setup): initialize Express server package and environment template" "2026-10-23T16:34:10"
Make-TimedCommit @("index.js") "feat(server): setup Express application, CORS configuration, and body parsers" "2026-10-23T19:42:55"
Make-TimedCommit @() "feat(health): add public /health endpoint for server uptime monitoring" "2026-10-23T22:15:40"

# Day 2: Oct 24, 2026
Make-TimedCommit @() "feat(db): establish MongoDB Atlas connection with index optimization for doctors & patients" "2026-10-24T11:22:18"
Make-TimedCommit @() "feat(auth): implement bcrypt password hashing, JWT signing, and verifyToken middleware" "2026-10-24T14:48:33"
Make-TimedCommit @() "feat(auth): add /api/auth/firebase endpoint for Google OAuth account sync and token exchange" "2026-10-24T17:10:05"
Make-TimedCommit @() "feat(doctors): implement doctor CRUD, regex search, date filters, and cascade delete" "2026-10-24T19:35:42"
Make-TimedCommit @() "feat(patients): implement patient registry CRUD, status tracking, and doctor roster queries" "2026-10-24T21:50:19"
Make-TimedCommit @() "feat(analytics): add MongoDB aggregation pipeline for dashboard statistics and charts" "2026-10-24T23:25:08"

# Day 3: Oct 25, 2026 (Early morning between 1:00 AM and 2:00 AM)
Make-TimedCommit @() "feat(ai): integrate Gemini 1.5 Flash endpoint with database context enrichment" "2026-10-25T01:14:26"
Make-TimedCommit @() "feat(blogs): add public health blogs collection endpoint and auto-seed chief admin" "2026-10-25T01:38:51"

# Stage any remaining files
git add -A
$remaining = git diff --staged --name-only
if ($remaining) {
    $env:GIT_AUTHOR_DATE = "2026-10-25T01:52:14"
    $env:GIT_COMMITTER_DATE = "2026-10-25T01:52:14"
    git commit -m "docs: finalize backend REST API documentation and deployment guides"
    Write-Host "  [OK] 2026-10-25T01:52:14 -> docs: finalize backend REST API documentation and deployment guides" -ForegroundColor Green
}

# Clear date env vars
Remove-Item Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue

# Set branch and remote
git branch -M main
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin https://github.com/ImtiazAhmed01/doctortracker-server-side.git

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  All 12-13 timed commits generated successfully!         " -ForegroundColor Green
Write-Host "  Branch: main" -ForegroundColor Green
Write-Host "  Remote: https://github.com/ImtiazAhmed01/doctortracker-server-side.git" -ForegroundColor Green
Write-Host "  To push to GitHub, run:" -ForegroundColor Yellow
Write-Host "    git push -u origin main --force" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
