@echo off
setlocal enabledelayedexpansion

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


REM === CONFIGURATION ===
set PROJECT_DIR=C:\Visual Studio Projects\Windward SE
set GITHUB_USERNAME=YaronGit88
set REPO_NAME=Windward-SE
set BRANCH=main



REM === STEP 0: Move to project folder ===
cd /d "%PROJECT_DIR%" || (echo  Invalid project directory & pause & exit /b)
echo Current directory: %CD%
echo.

REM === STEP 1: Detect script name and ignore itself in Git ===
set SCRIPT_NAME=%~nx0
if not exist ".gitignore" (
    echo Creating .gitignore...
    echo %SCRIPT_NAME% > .gitignore
) else (
    findstr /i "%SCRIPT_NAME%" .gitignore >nul || (
        echo Adding %SCRIPT_NAME% to .gitignore...
        echo %SCRIPT_NAME%>>.gitignore
    )
)
git rm --cached "%SCRIPT_NAME%" >nul 2>&1


REM === Make sure local changes are committed first ===
git add .
git commit -m "Local edits before push" 

REM === Pull remote but prefer local ===
git fetch origin %BRANCH%
git reset --hard HEAD
git merge -s ours origin/%BRANCH%

REM === Push to GitHub, overwriting remote ===
git push -u origin %BRANCH% --force

echo Local changes prioritized and pushed successfully.
pause


REM === STEP 2: Commit local changes before pulling ===
git add -A
git commit -m "Local edits before pull" 2>nul

REM === STEP 3: Abort unfinished Git operations ===
if exist ".git\rebase-apply" git rebase --abort
if exist ".git\rebase-merge" git rebase --abort
if exist ".git\MERGE_HEAD" git merge --abort

REM === STEP 4: Pull remote changes with rebase ===
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
)

git pull --rebase origin %BRANCH%

REM === STEP 5: Ask user for optional custom commit message ===
set /p CUSTOM_MSG=Enter commit message (leave empty for default): 

if "%CUSTOM_MSG%"=="" (
    set COMMIT_MESSAGE=Auto commit - %TIMESTAMP%
) else (
    set COMMIT_MESSAGE=Auto commit - %CUSTOM_MSG% %TIMESTAMP%
)

REM === STEP 6: Add & Commit ===
git add -A
git commit -m "%COMMIT_MESSAGE%" 2>nul

REM === STEP 7: Ensure branch ===
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%b
if not "%CURRENT_BRANCH%"=="%BRANCH%" (
    git checkout %BRANCH% 2>nul || git switch -c %BRANCH%
)

REM === STEP 8: Push changes ===
git push -u origin %BRANCH%

echo.
echo  Done! Commit message: "%COMMIT_MESSAGE%"
pause
