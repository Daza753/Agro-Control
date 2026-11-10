param(
  [Parameter(Mandatory = $true)]
  [string]$OutDir,
  [Parameter(Mandatory = $true)]
  [string]$TempDir
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $env:TEMP ("fincacontrol-build-" + [guid]::NewGuid().ToString('N'))
$steps = @(
  @{ Name = 'Preparando el entorno'; Estimate = 8; Weight = 5 },
  @{ Name = 'Compilando la aplicacion web (Vite)'; Estimate = 10; Weight = 12 },
  @{ Name = 'Empaquetando instalador y portable (Electron)'; Estimate = 240; Weight = 75 },
  @{ Name = 'Copiando y verificando instalador y portable'; Estimate = 20; Weight = 8 }
)
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Format-Duration([double]$Seconds) {
  $secondsRounded = [Math]::Max(0, [int][Math]::Ceiling($Seconds))
  $duration = [TimeSpan]::FromSeconds($secondsRounded)
  if ($duration.TotalHours -ge 1) {
    return '{0}h {1:00}m' -f [int]$duration.TotalHours, $duration.Minutes
  }
  if ($duration.TotalMinutes -ge 1) {
    return '{0}m {1:00}s' -f [int]$duration.TotalMinutes, $duration.Seconds
  }
  return '{0}s' -f $duration.Seconds
}

function Show-BuildProgress([int]$StepIndex, [double]$StepElapsed, [bool]$Complete = $false) {
  $completedWeight = 0
  for ($i = 0; $i -lt $StepIndex; $i++) {
    $completedWeight += $steps[$i].Weight
  }

  $step = $steps[$StepIndex]
  $stepFraction = if ($Complete) { 1.0 } else { [Math]::Min(0.95, $StepElapsed / $step.Estimate) }
  $percent = [Math]::Min(99, [int][Math]::Floor($completedWeight + ($step.Weight * $stepFraction)))
  $remainingCurrent = $step.Estimate - $StepElapsed

  if ($remainingCurrent -ge 0) {
    $remainingEstimate = $remainingCurrent
    for ($i = $StepIndex + 1; $i -lt $steps.Count; $i++) {
      $remainingEstimate += $steps[$i].Estimate
    }
    $status = "Etapa $($StepIndex + 1)/$($steps.Count) - $($step.Name) | Transcurrido: $(Format-Duration $stopwatch.Elapsed.TotalSeconds) | ETA aprox.: $(Format-Duration $remainingEstimate)"
  } else {
    $status = "Etapa $($StepIndex + 1)/$($steps.Count) - $($step.Name) | Transcurrido: $(Format-Duration $stopwatch.Elapsed.TotalSeconds) | ETA: recalculando (supero la estimacion de esta etapa)"
  }

  if ($Complete) {
    $percent = [Math]::Min(99, [int]($completedWeight + $step.Weight))
    $status = "Etapa $($StepIndex + 1)/$($steps.Count) completada | Tiempo transcurrido: $(Format-Duration $stopwatch.Elapsed.TotalSeconds)"
  }

  $barWidth = 24
  $filledWidth = [int][Math]::Floor($barWidth * $percent / 100)
  $bar = ('#' * $filledWidth) + ('-' * ($barWidth - $filledWidth))
  $line = "[{0}] {1,3}% | {2}" -f $bar, $percent, $status
  try {
    $lineWidth = [Math]::Max(1, [Console]::WindowWidth - 1)
  } catch {
    $lineWidth = 120
  }
  if ($line.Length -gt $lineWidth) {
    $line = $line.Substring(0, $lineWidth)
  }
  [Console]::Write("`r" + $line.PadRight($lineWidth))
  [Console]::Out.Flush()
}

function Invoke-TrackedCommand([string]$Command, [int]$StepIndex) {
  $attempt = 1
  while ($true) {
    $stdoutPath = Join-Path $logDir "step-$StepIndex-attempt-$attempt-out.log"
    $stderrPath = Join-Path $logDir "step-$StepIndex-attempt-$attempt-err.log"
    $commandPath = Join-Path $logDir "step-$StepIndex-attempt-$attempt.cmd"
    $exitCodePath = Join-Path $logDir "step-$StepIndex-attempt-$attempt-exitcode.txt"
    $stepWatch = [System.Diagnostics.Stopwatch]::StartNew()

    $commandLines = @(
      '@echo off',
      "cd /d `"$root`"",
      "call $Command",
      'if errorlevel 1 (',
      "  >`"$exitCodePath`" echo 1",
      ') else (',
      "  >`"$exitCodePath`" echo 0",
      ')',
      'exit /b'
    )
    [System.IO.File]::WriteAllLines($commandPath, [string[]]$commandLines, [System.Text.Encoding]::ASCII)

    $process = Start-Process -FilePath $env:ComSpec `
      -ArgumentList @('/d', '/c', ('call "' + $commandPath + '"')) `
      -WorkingDirectory $root `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -NoNewWindow `
      -PassThru

    while (-not $process.HasExited) {
      Start-Sleep -Milliseconds 500
      $process.Refresh()
      Show-BuildProgress -StepIndex $StepIndex -StepElapsed $stepWatch.Elapsed.TotalSeconds
    }
    $process.WaitForExit()
    Write-Host ''

    $stdout = if (Test-Path -LiteralPath $stdoutPath) {
      Get-Content -LiteralPath $stdoutPath -Raw
    } else {
      ''
    }
    $stderr = if (Test-Path -LiteralPath $stderrPath) {
      Get-Content -LiteralPath $stderrPath -Raw
    } else {
      ''
    }
    if ($stdout) { Write-Host $stdout -NoNewline }
    if ($stderr) { Write-Host $stderr -ForegroundColor Yellow -NoNewline }

    if (-not (Test-Path -LiteralPath $exitCodePath)) {
      throw "El comando termino sin generar el codigo de salida: $Command"
    }
    $exitCodeText = (Get-Content -LiteralPath $exitCodePath -Raw).Trim()
    $exitCode = 0
    if (-not [int]::TryParse($exitCodeText, [ref]$exitCode)) {
      throw "El comando genero un codigo de salida invalido '$exitCodeText': $Command"
    }
    if ($exitCode -eq 0) {
      return
    }

    throw "El comando fallo con codigo $exitCode`: $Command"
  }
}

try {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null

  Show-BuildProgress -StepIndex 0 -StepElapsed 0
  $tempPath = Join-Path $root $TempDir
  $outputPath = Join-Path $root $OutDir
  if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Recurse -Force
  }
  Show-BuildProgress -StepIndex 0 -StepElapsed $steps[0].Estimate -Complete $true

  Write-Host "`nGenerando los graficos del instalador desde el logo..."
  Invoke-TrackedCommand -Command 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate-installer-assets.ps1' -StepIndex 0

  Write-Host "`nCompilando la aplicacion web..."
  Invoke-TrackedCommand -Command 'npm run build' -StepIndex 1
  Show-BuildProgress -StepIndex 1 -StepElapsed $steps[1].Estimate -Complete $true

  Write-Host "`nEmpaquetando el instalador y el ejecutable portable..."
  $packageCommand = "npx electron-builder build --win nsis portable --x64 --config.directories.output=$TempDir"
  Invoke-TrackedCommand -Command $packageCommand -StepIndex 2
  Show-BuildProgress -StepIndex 2 -StepElapsed $steps[2].Estimate -Complete $true

  Write-Host "`nSeparando y verificando el instalador y el portable..."
  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Recurse -Force
  }
  $installerOutputPath = Join-Path $outputPath 'Instalador'
  $portableOutputPath = Join-Path $outputPath 'Portable'
  New-Item -ItemType Directory -Path $installerOutputPath -Force | Out-Null
  New-Item -ItemType Directory -Path $portableOutputPath -Force | Out-Null

  $files = @(Get-ChildItem -LiteralPath $tempPath -File)
  $installer = $files | Where-Object { $_.Name -like '*Setup*.exe' } | Select-Object -First 1
  $portable = $files | Where-Object {
    $_.Name -like '*.exe' -and $_.Name -notlike '*Setup*'
  } | Select-Object -First 1
  if (-not $installer -or -not $portable) {
    throw "No se encontraron el instalador y el ejecutable portable en '$tempPath'."
  }

  Copy-Item -LiteralPath $installer.FullName -Destination $installerOutputPath -Force
  Copy-Item -LiteralPath $portable.FullName -Destination $portableOutputPath -Force

  $installerBlockmap = Join-Path $tempPath ($installer.Name + '.blockmap')
  if (Test-Path -LiteralPath $installerBlockmap) {
    Copy-Item -LiteralPath $installerBlockmap -Destination $installerOutputPath -Force
  }
  $portableBlockmap = Join-Path $tempPath ($portable.Name + '.blockmap')
  if (Test-Path -LiteralPath $portableBlockmap) {
    Copy-Item -LiteralPath $portableBlockmap -Destination $portableOutputPath -Force
  }
  foreach ($metadata in $files | Where-Object { $_.Extension -eq '.yml' }) {
    Copy-Item -LiteralPath $metadata.FullName -Destination $installerOutputPath -Force
  }
  Show-BuildProgress -StepIndex 3 -StepElapsed $steps[3].Estimate -Complete $true
  Write-Host ''
  Write-Host "Instalador: $installerOutputPath\$($installer.Name)"
  Write-Host "Portable:   $portableOutputPath\$($portable.Name)"
  exit 0
} catch {
  Write-Host ''
  Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally {
  $stopwatch.Stop()
  if (Test-Path -LiteralPath $logDir) {
    Remove-Item -LiteralPath $logDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  $tempPath = Join-Path $root $TempDir
  if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Recurse -Force -ErrorAction SilentlyContinue
  }
}
