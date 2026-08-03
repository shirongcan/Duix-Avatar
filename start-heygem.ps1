$ErrorActionPreference = 'Stop'

$projectDirectory = 'D:\heygem'
$deployDirectory = 'D:\heygem\deploy'
$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$clientExecutable = 'D:\heygem\node_modules\electron\dist\electron.exe'
$logDirectory = 'D:\DOCKER_IMAGES'
$launcherLog = Join-Path $logDirectory 'heygem-launcher.log'
$clientOutputLog = Join-Path $logDirectory 'heygem-client.out.log'
$clientErrorLog = Join-Path $logDirectory 'heygem-client.err.log'

function Write-LaunchLog {
    param([string]$Message)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $launcherLog -Value "[$timestamp] $Message"
}

function Show-LaunchError {
    param([string]$Message)

    Write-LaunchLog "ERROR: $Message"
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        $Message,
        'HeyGem 启动失败',
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null
}

function Test-DockerReady {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        & docker info *> $null
        $dockerExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    return $dockerExitCode -eq 0
}

try {
    if (-not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -ItemType Directory -Path $logDirectory | Out-Null
    }

    Write-LaunchLog 'Starting HeyGem.'

    if (-not (Test-DockerReady)) {
        if (-not (Test-Path -LiteralPath $dockerDesktop)) {
            throw "未找到 Docker Desktop：$dockerDesktop"
        }

        Write-LaunchLog 'Launching Docker Desktop.'
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden

        $dockerReady = $false
        for ($attempt = 1; $attempt -le 90; $attempt++) {
            Start-Sleep -Seconds 2
            if (Test-DockerReady) {
                $dockerReady = $true
                break
            }
        }

        if (-not $dockerReady) {
            throw 'Docker Desktop 在 3 分钟内未能启动，请先检查 Docker Desktop。'
        }
    }

    Write-LaunchLog 'Docker is ready; starting HeyGem services.'
    Push-Location -LiteralPath $deployDirectory
    try {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $composeOutput = & docker compose up -d 2>&1
        $composeExitCode = $LASTEXITCODE
        $ErrorActionPreference = $previousErrorActionPreference
        $composeOutput | ForEach-Object { Write-LaunchLog $_ }
        if ($composeExitCode -ne 0) {
            throw 'HeyGem Docker 服务启动失败。'
        }
    }
    finally {
        Pop-Location
    }

    $existingClient = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'electron.exe' -and $_.ExecutablePath -eq $clientExecutable
    }

    if ($existingClient) {
        Write-LaunchLog 'HeyGem client is already running.'
        exit 0
    }

    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    Write-LaunchLog 'Launching HeyGem client.'
    Start-Process `
        -FilePath $npm `
        -ArgumentList 'start' `
        -WorkingDirectory $projectDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $clientOutputLog `
        -RedirectStandardError $clientErrorLog
}
catch {
    Show-LaunchError $_.Exception.Message
    exit 1
}
