# Local Development Setup Script
# Sets up local emulators for Firebase and Cloudflare Worker testing

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipInstall = $false
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

Write-ColorOutput Yellow "========================================="
Write-ColorOutput Yellow "Japanese Project - Local Development Setup"
Write-ColorOutput Yellow "========================================="
Write-Output ""

# Install dependencies
if (-not $SkipInstall) {
    Write-ColorOutput Cyan "Installing dependencies..."
    
    # Install global tools
    Write-Output "Installing Firebase CLI..."
    npm install -g firebase-tools
    
    Write-Output "Installing Wrangler CLI..."
    npm install -g wrangler
    
    # Install function dependencies
    Write-Output "Installing Firebase function dependencies..."
    Push-Location "$ProjectRoot\functions"
    npm install
    Pop-Location
    
    Write-ColorOutput Green "✓ Dependencies installed"
}

# Create .env.local file for local development
Write-ColorOutput Cyan "`nCreating local environment configuration..."

$envContent = @"
# Local Development Environment
# This file is for local testing only - DO NOT COMMIT

# Firebase Configuration
FIREBASE_PROJECT_ID=japanese-slots
FIREBASE_REGION=us-central1

# Cloudflare Worker Configuration
CLOUDFLARE_WORKER_URL=http://localhost:8787
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500

# Local server port
DEV_SERVER_PORT=5500
"@

$envPath = "$ProjectRoot\.env.local"
if (-not (Test-Path $envPath)) {
    Set-Content -Path $envPath -Value $envContent
    Write-ColorOutput Green "✓ Created .env.local"
} else {
    Write-ColorOutput Yellow "⚠ .env.local already exists, skipping"
}

# Update .gitignore
Write-ColorOutput Cyan "`nUpdating .gitignore..."

$gitignorePath = "$ProjectRoot\.gitignore"
$gitignoreContent = @"
# Environment files
.env
.env.local
.env.*.local

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log

# Cloudflare
.wrangler/
.dev.vars
wrangler.toml.local

# Service accounts (NEVER commit these!)
*service-account*.json
firebase-adminsdk*.json

# Node modules
node_modules/
functions/node_modules/
firebase_functions/*/node_modules/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db
"@

if (-not (Test-Path $gitignorePath)) {
    Set-Content -Path $gitignorePath -Value $gitignoreContent
    Write-ColorOutput Green "✓ Created .gitignore"
} else {
    Write-ColorOutput Yellow "⚠ .gitignore already exists, skipping"
}

# Create VS Code launch configuration
Write-ColorOutput Cyan "`nCreating VS Code debug configuration..."

$vscodeDir = "$ProjectRoot\.vscode"
if (-not (Test-Path $vscodeDir)) {
    New-Item -ItemType Directory -Path $vscodeDir | Out-Null
}

$launchConfig = @"
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Debug Firebase Functions",
            "runtimeExecutable": "npm",
            "runtimeArgs": [
                "run-script",
                "serve"
            ],
            "cwd": "`${workspaceFolder}/functions",
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"
        },
        {
            "type": "chrome",
            "request": "launch",
            "name": "Launch Chrome",
            "url": "http://localhost:5500",
            "webRoot": "`${workspaceFolder}"
        }
    ]
}
"@

$launchPath = "$vscodeDir\launch.json"
if (-not (Test-Path $launchPath)) {
    Set-Content -Path $launchPath -Value $launchConfig
    Write-ColorOutput Green "✓ Created VS Code launch.json"
} else {
    Write-ColorOutput Yellow "⚠ launch.json already exists, skipping"
}

# Create package.json scripts for easy development
Write-ColorOutput Cyan "`nUpdating package.json..."

$packageJsonPath = "$ProjectRoot\package.json"
if (Test-Path $packageJsonPath) {
    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
} else {
    $packageJson = @{
        name = "japanese-project"
        version = "1.0.0"
        description = "Japanese culture and gambling project"
        scripts = @{}
    }
}

# Add helpful scripts
$packageJson.scripts = @{
    "dev" = "firebase emulators:start"
    "dev:worker" = "cd cloudflare && wrangler dev"
    "dev:functions" = "cd functions && npm run serve"
    "deploy" = "powershell -ExecutionPolicy Bypass -File ./deploy-backend.ps1 -Target all"
    "deploy:cf" = "powershell -ExecutionPolicy Bypass -File ./deploy-backend.ps1 -Target cloudflare"
    "deploy:fb" = "powershell -ExecutionPolicy Bypass -File ./deploy-backend.ps1 -Target firebase"
    "logs:worker" = "cd cloudflare && wrangler tail"
    "logs:functions" = "firebase functions:log"
}

$packageJson | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath
Write-ColorOutput Green "✓ Updated package.json"

# Create README for local development
Write-ColorOutput Cyan "`nCreating local development guide..."

$devReadme = @"
# Local Development Guide

## Prerequisites
- Node.js 20+
- Firebase CLI
- Wrangler CLI
- Live Server (VS Code extension) or similar

## Quick Start

### 1. Start Firebase Emulators
\`\`\`powershell
npm run dev
\`\`\`

This starts:
- Firestore emulator on http://localhost:8080
- Functions emulator on http://localhost:5001
- Emulator UI on http://localhost:4000

### 2. Start Cloudflare Worker (in new terminal)
\`\`\`powershell
npm run dev:worker
\`\`\`

Worker will run on http://localhost:8787

### 3. Start Local Web Server (in new terminal)
\`\`\`powershell
# Using Python
python -m http.server 5500

# OR using VS Code Live Server extension
# Right-click index.html and select "Open with Live Server"
\`\`\`

Your site will be at http://localhost:5500

## Development Workflow

1. **Make changes** to your code
2. **Test locally** using emulators
3. **Commit** your changes
4. **Deploy** when ready:
   \`\`\`powershell
   npm run deploy
   \`\`\`

## Testing

### Test Cloudflare Worker
\`\`\`powershell
curl -X POST http://localhost:8787 \`
  -H "Content-Type: application/json" \`
  -d '{"name":"TestPlayer","score":1000,"collection":"scores"}'
\`\`\`

### Test Firebase Function
Open browser console on your local site:
\`\`\`javascript
const functions = firebase.functions();
functions.useEmulator("localhost", 5001); // Use emulator
const placeBet = functions.httpsCallable('placeBetAndSpin');
placeBet({ bet: 10 }).then(console.log);
\`\`\`

## Useful Commands

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start all Firebase emulators |
| \`npm run dev:worker\` | Start Cloudflare Worker locally |
| \`npm run deploy\` | Deploy everything to production |
| \`npm run logs:worker\` | Tail Cloudflare Worker logs |
| \`npm run logs:functions\` | View Firebase Function logs |

## Environment Variables

Create a \`.dev.vars\` file in the \`cloudflare/\` directory:

\`\`\`env
FIREBASE_SERVICE_ACCOUNT=<your-service-account-json>
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
\`\`\`

## Troubleshooting

### Emulator not starting
\`\`\`powershell
firebase emulators:kill
firebase emulators:start
\`\`\`

### Port already in use
Change ports in firebase.json:
\`\`\`json
{
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 }
  }
}
\`\`\`

### Worker not connecting to Firebase
Make sure \`.dev.vars\` is set up correctly in the cloudflare directory.

## VS Code Extensions (Recommended)

- Live Server
- Firebase Explorer
- ESLint
- Prettier

## Next Steps

1. Set up Firebase Authentication
2. Add unit tests
3. Set up CI/CD pipeline
4. Configure staging environment
"@

$devReadmePath = "$ProjectRoot\DEV_GUIDE.md"
Set-Content -Path $devReadmePath -Value $devReadme
Write-ColorOutput Green "✓ Created DEV_GUIDE.md"

# Summary
Write-ColorOutput Green "`n========================================="
Write-ColorOutput Green "Setup Complete!"
Write-ColorOutput Green "========================================="

Write-Output "`nYour local development environment is ready!"
Write-Output ""
Write-Output "To start developing:"
Write-Output "1. Open 3 terminals"
Write-Output "2. Terminal 1: npm run dev          (Firebase emulators)"
Write-Output "3. Terminal 2: npm run dev:worker   (Cloudflare Worker)"
Write-Output "4. Terminal 3: Start Live Server or python -m http.server 5500"
Write-Output ""
Write-Output "Documentation:"
Write-Output "- Backend setup: BACKEND_SETUP.md"
Write-Output "- Local development: DEV_GUIDE.md"
Write-Output ""
Write-ColorOutput Yellow "Important: Don't forget to set up .dev.vars in cloudflare/ directory!"
