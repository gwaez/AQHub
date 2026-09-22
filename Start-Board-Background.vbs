' ASCII-only: start Watch-Board.ps1 with no visible window (WScript style 0).
Option Explicit
Dim fso, sh, root, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\Watch-Board.ps1"""
sh.Run cmd, 0, False
