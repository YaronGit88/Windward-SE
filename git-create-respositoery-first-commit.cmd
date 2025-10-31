@echo off
REM --- CONFIGURE THESE ---
SET REPO_NAME=my-project
SET COMMIT_MESSAGE="Initial commit"
SET VISIBILITY=public  REM or private

REM --- CHANGE TO YOUR PROJECT FOLDER ---
cd C:\path\to\your\project

REM --- INIT GIT ---
git init

REM --- ADD FILES ---
git add .

REM --- COMMIT ---
git commit -m %COMMIT_MESSAGE%

REM --- CREATE GITHUB REPO AND SET REMOTE ---
gh repo create %REPO_NAME% --%VISIBILITY% --source=. --remote=origin --push

echo.
echo Repository "%REPO_NAME%" pushed to GitHub successfully!
pause
