# Regenera o banner NSIS a partir do icone do app.
# NSIS so aceita BMP 24 bpp. Rode quando o icone ou o visual mudar:
#   powershell -ExecutionPolicy Bypass -File golive-gui/build/build-installer-images.ps1
#
# Paleta = tema escuro OLED da GUI (style.css), nao o roxo do Dozamigos:
#   canvas #0F0F12, surface #1A1A1F, discord #5865F2, go-live #7BC98C.

Add-Type -AssemblyName System.Drawing

$here = $PSScriptRoot
$iconPath = Join-Path $here 'icon.png'
if (-not (Test-Path $iconPath)) { throw "faltou $iconPath" }

$icon = [System.Drawing.Image]::FromFile($iconPath)

$family = $null
foreach ($name in @('Segoe UI', 'Inter', 'Arial')) {
  try { $family = New-Object System.Drawing.FontFamily $name; break } catch { }
}
if ($null -eq $family) { throw 'nenhuma fonte encontrada' }

function New-Canvas([int]$width, [int]$height) {
  $bmp = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.TextRenderingHint = 'AntiAliasGridFit'

  $rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
  $from = [System.Drawing.Color]::FromArgb(15, 15, 18)
  $to = [System.Drawing.Color]::FromArgb(26, 26, 31)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $from, $to, 45.0
  $g.FillRectangle($bg, $rect)
  $bg.Dispose()

  return @{ Bitmap = $bmp; Graphics = $g }
}

# Luz ambiente da GUI: blob radial discord (rgba(88, 101, 242, 0.1) no CSS).
function Add-Glow($g, [int]$cx, [int]$cy, [int]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(($cx - $radius), ($cy - $radius), ($radius * 2), ($radius * 2))
  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(110, 88, 101, 242)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 88, 101, 242))
  $g.FillPath($glow, $path)
  $glow.Dispose()
  $path.Dispose()
}

function Save-Canvas($canvas, [string]$name) {
  $out = Join-Path $here $name
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $canvas.Bitmap.Dispose()
  if (-not (Test-Path $out)) { throw "falhei ao gravar $out" }
  Write-Host "wrote $out"
}

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 245, 247))
$mint = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(123, 201, 140))
$grey = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(111, 111, 122))
$bold = [System.Drawing.FontStyle]::Bold

# Header: toda pagina menos welcome/finish (150x57).
$header = New-Canvas 150 57
Add-Glow $header.Graphics 24 28 32
$header.Graphics.DrawImage($icon, 6, 8, 40, 40)
$header.Graphics.DrawString('GoLive', (New-Object System.Drawing.Font $family, 13, $bold), $white, 48, 6)
$header.Graphics.DrawString('Bypass', (New-Object System.Drawing.Font $family, 12, $bold), $mint, 48, 28)
Save-Canvas $header 'installerHeader.bmp'

# Sidebar: welcome e finish (164x314).
$sidebar = New-Canvas 164 314
Add-Glow $sidebar.Graphics 82 96 108
$sidebar.Graphics.DrawImage($icon, 34, 44, 96, 96)

$centered = New-Object System.Drawing.StringFormat
$centered.Alignment = 'Center'
$line = New-Object System.Drawing.RectangleF 4, 156, 156, 28
$sidebar.Graphics.DrawString('GoLiveBypass', (New-Object System.Drawing.Font $family, 14, $bold), $white, $line, $centered)
$line = New-Object System.Drawing.RectangleF 4, 186, 156, 24
$sidebar.Graphics.DrawString('Go Live', (New-Object System.Drawing.Font $family, 12, $bold), $mint, $line, $centered)
$line = New-Object System.Drawing.RectangleF 4, 272, 156, 22
$sidebar.Graphics.DrawString('Brasil', (New-Object System.Drawing.Font $family, 9), $grey, $line, $centered)
Save-Canvas $sidebar 'installerSidebar.bmp'

$icon.Dispose()
$white.Dispose()
$mint.Dispose()
$grey.Dispose()
