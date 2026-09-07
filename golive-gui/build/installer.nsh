; Pasta padrao C:\GoLiveBypass (electron-builder le InstallLocation no preInit).
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\GoLiveBypass"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\GoLiveBypass"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\GoLiveBypass"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\GoLiveBypass"
!macroend

; Sem Caption o Windows 11 usa FileDescription/MuiCache na barra de tarefas.
; A primeira geracao do Setup gravou a descricao longa nesse cache.
!macro customHeader
  Caption "GoLiveBypass"
!macroend

!macro customInit
  System::Call 'shell32::SetCurrentProcessExplicitAppUserModelID(w "com.golivebypass.gui.installer")'
!macroend

