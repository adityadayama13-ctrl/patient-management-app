; Clinic Patient Management App - Windows installer (Inno Setup 6)
; Build with installer\build-installer.ps1, which prepares installer\stage first.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{6F0C2B7E-3D55-4C3E-9B0B-5A1C0E7D2F41}
AppName=Clinic Patient Management
AppVersion={#AppVersion}
AppPublisher=Clinic App
DefaultDirName={sd}\ClinicApp
DefaultGroupName=Clinic App
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=Output
OutputBaseFilename=ClinicApp-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Clinic Patient Management
CloseApplications=no

[Dirs]
; The app runs as a normal Windows user and writes its .env, logs and lab uploads here.
Name: "{app}"; Permissions: users-modify
Name: "{app}\uploads\labs"; Permissions: users-modify
Name: "{app}\logs"; Permissions: users-modify

[Files]
Source: "stage\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: ".env,uploads,logs"

[Icons]
Name: "{autodesktop}\Clinic App"; Filename: "{app}\start.bat"; WorkingDir: "{app}"; Comment: "Start the Clinic Patient Management app"
Name: "{group}\Clinic App"; Filename: "{app}\start.bat"; WorkingDir: "{app}"
Name: "{group}\Setup logs"; Filename: "{app}\logs"
Name: "{group}\Uninstall Clinic App"; Filename: "{uninstallexe}"

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Clinic App (Port 5000)"""; Flags: runhidden; RunOnceId: "RemoveClinicFirewallRule"

[UninstallDelete]
; The database, the .env file and the uploads folder are kept on purpose: they hold clinic data.
Type: filesandordirs; Name: "{app}\logs"

[Code]
var
  ModePage: TInputOptionWizardPage;

procedure InitializeWizard;
begin
  ModePage := CreateInputOptionPage(wpSelectDir,
    'How will the clinic use the app?',
    'Choose how this PC will be used.',
    'You can run Setup again later to change this.',
    True, False);
  ModePage.Add('Server PC: phones, tablets and other PCs on the clinic WiFi connect to this PC');
  ModePage.Add('Single PC: the app is used on this PC only');
  ModePage.SelectedValueIndex := 0;
end;

function ModeName: String;
begin
  if ModePage.SelectedValueIndex = 1 then
    Result := 'Standalone'
  else
    Result := 'Server';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Params: String;
begin
  if CurStep <> ssPostInstall then Exit;

  WizardForm.StatusLabel.Caption := 'Setting up the database. A setup window will open; please leave it running...';
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\setup.ps1') +
            '" -Mode ' + ModeName + ' -FromInstaller';

  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params,
              ExpandConstant('{app}'), SW_SHOW, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Setup could not start PowerShell. The app files were copied, but the database was not set up.' + #13#10 +
           'Run setup.bat from ' + ExpandConstant('{app}') + ' to finish.', mbError, MB_OK);
  end
  else if ResultCode = 1 then
  begin
    MsgBox('Database setup did not finish. See the logs folder in ' + ExpandConstant('{app}') + ' for details.' + #13#10 +
           'You can run setup.bat from that folder to try again.', mbError, MB_OK);
  end
  else if ResultCode = 2 then
  begin
    MsgBox('The app is installed, but the database was not configured (PostgreSQL password was not accepted).' + #13#10 +
           'Edit the .env file in ' + ExpandConstant('{app}') + ' and create the database clinic_db, then start the app.', mbInformation, MB_OK);
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + NewLine + 'Use:' + NewLine + Space;
  if ModePage.SelectedValueIndex = 1 then
    Result := Result + 'Single PC (this PC only)'
  else
    Result := Result + 'Server PC (other devices connect over WiFi; firewall port 5000 opens)';
  Result := Result + NewLine + NewLine + 'PostgreSQL 16 will be installed if this PC does not have it (internet needed, about 300 MB).';
end;
