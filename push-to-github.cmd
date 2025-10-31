@echo on

:: Get date and time parts
for /f "tokens=1-4 delims=:.," %%a in ("%time%") do (
    set HOUR=%%a
    set MINUTE=%%b
    set SECOND=%%c
    set CENTI=%%d
)

:: Remove separators from date
set DATESTR=%date:~10,4%%date:~4,2%%date:~7,2%

:: Build pseudo-millisecond timestamp
set TIMESTAMP=%DATESTR%%HOUR%%MINUTE%%SECOND%%CENTI%


REM --- CONFIGURE THESE ---
SET GITHUB_USERNAME=YaronGit88
SET REPO_NAME=Windward-SE
SET COMMIT_MESSAGE="commit %TIMESTAMP%"

REM --- CHANGE TO YOUR PROJECT FOLDER ---
cd "C:\Visual Studio Projects\Windward SE"

REM --- INIT GIT ---
git init

REM --- ADD FILES ---
git add .

REM --- COMMIT ---
git commit -m %COMMIT_MESSAGE%

REM --- ADD REMOTE ---
git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git

REM --- SET MAIN BRANCH ---
git branch -M main

REM --- PUSH TO GITHUB ---
git push -u origin main


