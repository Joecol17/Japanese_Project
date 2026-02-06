# Backend Deployment Script for Japanese Project
# This script helps deploy both Cloudflare Workers and Firebase Functions

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('all', 'cloudflare', 'firebase', 'rules')]
    [string]$Target = 'all',
    
    [Parameter(Mandatory=$false)]
    [switch]$Production = $false
)

$ProjectRoot = "c:\Users\josep\OneDrive - Farnborough College of Technology\Documents\GitHub\Japanese_Project"
$ErrorActionPreference = "Stop"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-Command($Command) {
    try {
        if (Get-Command $Command -ErrorAction Stop) {
            return $true
        }
    } catch {
        return $false
    }
}

Write-ColorOutput Yellow "==================================="
Write-ColorOutput Yellow "Japanese Project Backend Deployment"
Write-ColorOutput Yellow "==================================="
Write-Output ""

# Check prerequisites
Write-ColorOutput Cyan "Checking prerequisites..."

if (-not (Test-Command "node")) {
    Write-ColorOutput Red "ERROR: Node.js is not installed"
    exit 1
}

if (-not (Test-Command "npm")) {
    Write-ColorOutput Red "ERROR: npm is not installed"
    exit 1
}

Write-ColorOutput Green "✓ Node.js and npm are installed"

# Deploy Cloudflare Worker
function Deploy-Cloudflare {
    Write-ColorOutput Cyan "`n--- Deploying Cloudflare Worker ---"
    
    if (-not (Test-Command "wrangler")) {
        Write-ColorOutput Yellow "Wrangler not found. Installing..."
        npm install -g wrangler
    }
    
    Write-ColorOutput Green "✓ Wrangler CLI is available"
    
    Push-Location "$ProjectRoot\cloudflare"
    
    try {
        Write-Output "Checking Wrangler authentication..."
        $whoami = wrangler whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput Yellow "Not logged in to Wrangler. Please authenticate..."
            wrangler login
        }
        
        Write-ColorOutput Yellow "Deploying worker..."
        wrangler deploy
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput Green "✓ Cloudflare Worker deployed successfully!"
            Write-Output "Worker URL: https://save-score.japanesegyanburu.workers.dev"
        } else {
            Write-ColorOutput Red "✗ Cloudflare Worker deployment failed"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# Deploy Firebase Functions
function Deploy-Firebase {
    Write-ColorOutput Cyan "`n--- Deploying Firebase Functions ---"
    
    if (-not (Test-Command "firebase")) {
        Write-ColorOutput Yellow "Firebase CLI not found. Installing..."
        npm install -g firebase-tools
    }
    
    Write-ColorOutput Green "✓ Firebase CLI is available"
    
    Push-Location "$ProjectRoot"
    
    try {
        Write-Output "Checking Firebase authentication..."
        $projects = firebase projects:list 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput Yellow "Not logged in to Firebase. Please authenticate..."
            firebase login
        }
        
        # Install dependencies
        Write-ColorOutput Yellow "Installing function dependencies..."
        Push-Location "$ProjectRoot\functions"
        npm install
        Pop-Location
        
        # Deploy
        Write-ColorOutput Yellow "Deploying Firebase Functions..."
        if ($Production) {
            firebase deploy --only functions --project japanese-slots
        } else {
            firebase deploy --only functions
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput Green "✓ Firebase Functions deployed successfully!"
        } else {
            Write-ColorOutput Red "✗ Firebase Functions deployment failed"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# Deploy Firestore Rules
function Deploy-FirestoreRules {
    Write-ColorOutput Cyan "`n--- Deploying Firestore Rules ---"
    
    if (-not (Test-Command "firebase")) {
        Write-ColorOutput Red "ERROR: Firebase CLI not installed"
        exit 1
    }
    
    Push-Location "$ProjectRoot"
    
    try {
        Write-ColorOutput Yellow "Deploying Firestore rules and indexes..."
        if ($Production) {
            firebase deploy --only firestore --project japanese-slots
        } else {
            firebase deploy --only firestore
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput Green "✓ Firestore rules deployed successfully!"
        } else {
            Write-ColorOutput Red "✗ Firestore rules deployment failed"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# Check if service account is configured
function Check-ServiceAccount {
    Write-ColorOutput Cyan "`nChecking Cloudflare Worker secrets..."
    Push-Location "$ProjectRoot\cloudflare"
    
    try {
        $secrets = wrangler secret list 2>&1 | Out-String
        if ($secrets -match "FIREBASE_SERVICE_ACCOUNT") {
            Write-ColorOutput Green "✓ FIREBASE_SERVICE_ACCOUNT secret is configured"
        } else {
            Write-ColorOutput Yellow "⚠ FIREBASE_SERVICE_ACCOUNT secret is NOT configured"
            Write-Output "You need to set this secret using:"
            Write-Output "  wrangler secret put FIREBASE_SERVICE_ACCOUNT"
            Write-Output ""
            $response = Read-Host "Do you want to set it now? (y/n)"
            if ($response -eq 'y') {
                wrangler secret put FIREBASE_SERVICE_ACCOUNT
            }
        }
    } finally {
        Pop-Location
    }
}

# Main deployment logic
switch ($Target) {
    'cloudflare' {
        Check-ServiceAccount
        Deploy-Cloudflare
    }
    'firebase' {
        Deploy-Firebase
    }
    'rules' {
        Deploy-FirestoreRules
    }
    'all' {
        Check-ServiceAccount
        Deploy-Cloudflare
        Deploy-Firebase
        Deploy-FirestoreRules
    }
}

Write-ColorOutput Green "`n==================================="
Write-ColorOutput Green "Deployment Complete!"
Write-ColorOutput Green "==================================="

# Show next steps
Write-Output "`nNext steps:"
Write-Output "1. Test Cloudflare Worker: https://save-score.japanesegyanburu.workers.dev"
Write-Output "2. Test Firebase Functions in your app"
Write-Output "3. Check Firebase Console for function logs"
Write-Output "4. Monitor Cloudflare Workers analytics"
Write-Output ""
Write-Output "Useful commands:"
Write-Output "  wrangler tail              # View Cloudflare Worker logs"
Write-Output "  firebase functions:log     # View Firebase Function logs"
Write-Output "  firebase emulators:start   # Test locally"
