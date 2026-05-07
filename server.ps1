param(
  [int]$Port = 8000,
  [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

function Find-HeaderEnd {
  param([byte[]]$Bytes)

  if ($Bytes.Length -lt 4) {
    return -1
  }

  for ($i = 0; $i -le ($Bytes.Length - 4); $i++) {
    if ($Bytes[$i] -eq 13 -and $Bytes[$i + 1] -eq 10 -and $Bytes[$i + 2] -eq 13 -and $Bytes[$i + 3] -eq 10) {
      return $i
    }
  }

  return -1
}

function Read-HttpRequest {
  param([System.Net.Sockets.NetworkStream]$Stream)

  $buffer = New-Object byte[] 4096
  $memory = New-Object System.IO.MemoryStream
  $encoding = [System.Text.Encoding]::UTF8

  while ($true) {
    $read = $Stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) {
      return $null
    }

    $memory.Write($buffer, 0, $read)
    $bytes = $memory.ToArray()
    $headerEnd = Find-HeaderEnd -Bytes $bytes

    if ($headerEnd -ge 0) {
      $headerText = $encoding.GetString($bytes, 0, $headerEnd)
      $lines = $headerText -split "`r`n"
      $requestParts = $lines[0] -split " "
      if ($requestParts.Length -lt 2) {
        return $null
      }

      return [pscustomobject]@{
        Method = $requestParts[0].ToUpperInvariant()
        Path = $requestParts[1]
      }
    }
  }
}

function Get-StatusText {
  param([int]$StatusCode)

  switch ($StatusCode) {
    200 { "OK" }
    404 { "Not Found" }
    410 { "Gone" }
    500 { "Internal Server Error" }
    default { "OK" }
  }
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [byte[]]$Body
  )

  if ($null -eq $Body) {
    $Body = @()
  }

  $statusText = Get-StatusText -StatusCode $StatusCode
  $headerText = @(
    "HTTP/1.1 $StatusCode $statusText"
    "Content-Type: $ContentType"
    "Content-Length: $($Body.Length)"
    "Cache-Control: no-store"
    "Connection: close"
    ""
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Send-Text {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [string]$Text
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Send-Response -Stream $Stream -StatusCode $StatusCode -ContentType $ContentType -Body $bytes
}

function Get-MimeType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".sql" { "text/plain; charset=utf-8" }
    ".svg" { "image/svg+xml" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    default { "application/octet-stream" }
  }
}

function Handle-Request {
  param(
    [pscustomobject]$Request,
    [System.Net.Sockets.NetworkStream]$Stream
  )

  $pathOnly = ($Request.Path -split "\?")[0]
  if ($pathOnly.StartsWith("/api/")) {
    Send-Text -Stream $Stream -StatusCode 410 -ContentType "application/json; charset=utf-8" -Text '{"error":"This app now uses Supabase directly."}'
    return
  }

  if ($pathOnly -eq "/") {
    $pathOnly = "/index.html"
  }

  $relativePath = [System.Uri]::UnescapeDataString($pathOnly.TrimStart("/")).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $rootFullPath = [System.IO.Path]::GetFullPath($Root)
  $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootFullPath, $relativePath))

  if (-not $fullPath.StartsWith($rootFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Send-Text -Stream $Stream -StatusCode 404 -ContentType "application/json; charset=utf-8" -Text '{"error":"Not found"}'
    return
  }

  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    Send-Text -Stream $Stream -StatusCode 404 -ContentType "application/json; charset=utf-8" -Text '{"error":"Not found"}'
    return
  }

  $bytes = [System.IO.File]::ReadAllBytes($fullPath)
  Send-Response -Stream $Stream -StatusCode 200 -ContentType (Get-MimeType -Path $fullPath) -Body $bytes
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()

Write-Host "School schedule app running at http://localhost:$Port/"
Write-Host "Supabase settings: $([System.IO.Path]::Combine($Root, 'supabase-config.js'))"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $request = Read-HttpRequest -Stream $stream
    if ($null -ne $request) {
      Handle-Request -Request $request -Stream $stream
    }
  } catch {
    try {
      Send-Text -Stream $stream -StatusCode 500 -ContentType "application/json; charset=utf-8" -Text '{"error":"Internal server error"}'
    } catch {
    }
  } finally {
    $client.Close()
  }
}
