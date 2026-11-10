$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logoPath = Join-Path $root 'public\images\logo.png'
$sidebarPath = Join-Path $root 'electron\installer-sidebar.bmp'
$headerPath = Join-Path $root 'electron\installer-header.bmp'

Add-Type -AssemblyName System.Drawing

function Draw-ContainedImage(
  [System.Drawing.Graphics]$Graphics,
  [System.Drawing.Image]$Image,
  [System.Drawing.Rectangle]$Bounds
) {
  $scale = [Math]::Min($Bounds.Width / $Image.Width, $Bounds.Height / $Image.Height)
  $width = [int][Math]::Round($Image.Width * $scale)
  $height = [int][Math]::Round($Image.Height * $scale)
  $x = $Bounds.X + [int](($Bounds.Width - $width) / 2)
  $y = $Bounds.Y + [int](($Bounds.Height - $height) / 2)
  $Graphics.DrawImage($Image, $x, $y, $width, $height)
}

if (-not (Test-Path -LiteralPath $logoPath)) {
  throw "No se encontró el logo de la aplicación: $logoPath"
}

$logo = [System.Drawing.Image]::FromFile($logoPath)
$sidebar = New-Object System.Drawing.Bitmap 164, 314
$graphics = [System.Drawing.Graphics]::FromImage($sidebar)
try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([System.Drawing.Color]::FromArgb(15, 54, 43))
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0, 0, 164, 314),
    [System.Drawing.Color]::FromArgb(15, 54, 43),
    [System.Drawing.Color]::FromArgb(4, 110, 75),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  try {
    $graphics.FillRectangle($gradient, 0, 0, 164, 314)
  } finally {
    $gradient.Dispose()
  }
  $panel = New-Object System.Drawing.Rectangle 18, 30, 128, 128
  $graphics.FillRectangle(
    (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)),
    $panel
  )
  Draw-ContainedImage $graphics $logo (New-Object System.Drawing.Rectangle 26, 38, 112, 112)

  $titleFont = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
  $subtitleFont = New-Object System.Drawing.Font('Segoe UI', 8, [System.Drawing.FontStyle]::Regular)
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $softBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 235, 228))
  try {
    $titleFormat = New-Object System.Drawing.StringFormat
    $titleFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('FINCA CONTROL', $titleFont, $whiteBrush, (New-Object System.Drawing.RectangleF 8, 184, 148, 28), $titleFormat)
    $subtitleFormat = New-Object System.Drawing.StringFormat
    $subtitleFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('Gestion agricola y ganadera', $subtitleFont, $softBrush, (New-Object System.Drawing.RectangleF 8, 216, 148, 38), $subtitleFormat)
    $titleFormat.Dispose()
    $subtitleFormat.Dispose()
  } finally {
    $titleFont.Dispose()
    $subtitleFont.Dispose()
    $whiteBrush.Dispose()
    $softBrush.Dispose()
  }
  $sidebar.Save($sidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
  $graphics.Dispose()
  $sidebar.Dispose()
  $logo.Dispose()
}

$logo = [System.Drawing.Image]::FromFile($logoPath)
$header = New-Object System.Drawing.Bitmap 150, 57
$graphics = [System.Drawing.Graphics]::FromImage($header)
try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $headerBounds = New-Object System.Drawing.Rectangle 0, 0, 150, 57
  $headerGradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $headerBounds,
    [System.Drawing.Color]::FromArgb(15, 54, 43),
    [System.Drawing.Color]::FromArgb(4, 110, 75),
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
  )
  try {
    $graphics.FillRectangle($headerGradient, $headerBounds)
  } finally {
    $headerGradient.Dispose()
  }
  $logoPanel = New-Object System.Drawing.Rectangle 108, 5, 38, 38
  $logoBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  try {
    $graphics.FillEllipse($logoBrush, $logoPanel)
  } finally {
    $logoBrush.Dispose()
  }
  Draw-ContainedImage $graphics $logo (New-Object System.Drawing.Rectangle 112, 9, 30, 30)
  $headerFont = New-Object System.Drawing.Font('Segoe UI', 8, [System.Drawing.FontStyle]::Bold)
  $taglineFont = New-Object System.Drawing.Font('Segoe UI', 5.5, [System.Drawing.FontStyle]::Regular)
  $headerTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 240, 230))
  try {
    $graphics.DrawString('FINCA CONTROL', $headerFont, $headerTextBrush, 8, 14)
    $graphics.DrawString('GESTION AGROPECUARIA', $taglineFont, $taglineBrush, 8, 29)
  } finally {
    $headerFont.Dispose()
    $taglineFont.Dispose()
    $headerTextBrush.Dispose()
    $taglineBrush.Dispose()
  }
  $header.Save($headerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
  $graphics.Dispose()
  $header.Dispose()
  $logo.Dispose()
}

Write-Output "Graficos del instalador creados desde public\images\logo.png"
