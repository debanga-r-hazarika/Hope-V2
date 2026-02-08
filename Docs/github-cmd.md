## Git & GitHub quick commands

Reference commands for this project (PowerShell-friendly).

### One-time setup
- Initialize (already done):  
  ```bash
  git init -b main
  ```
- Set identity (local to this repo):  
  ```bash
  git config user.name "YOUR_NAME"
  git config user.email "YOUR_EMAIL"
  ```
- Add remote:  
  ```bash
  git remote add origin https://github.com/debanga-r-hazarika/Hope.git
  ```

### Auth with GitHub CLI
- Install (winget): `winget install --id GitHub.cli -e --source winget`
- Check version: `gh --version`
- Login (browser flow): `gh auth login`
- Verify: `gh auth status`

### Daily workflow
- Check status: `git status -sb`
- Stage changes: `git add .`  (or specify files)
- Commit: `git commit -m "Your message"`
- Push: `git push -u origin main`  (first push)  
  Afterwards: `git push`
- Pull latest: `git pull --rebase`

### Remote/branch helpers
- List remotes: `git remote -v`
- Change remote URL:  
  ```bash
  git remote set-url origin https://github.com/debanga-r-hazarika/Hope.git
  ```
- Create/switch branch:  
  ```bash
  git checkout -b feature/xyz
  git push -u origin feature/xyz
  ```

### Troubleshooting snippets
- See last commits: `git log --oneline -n 10`
- Undo staged file (keep changes): `git restore --staged <file>`
- Drop local changes to file: `git checkout -- <file>`
- If push rejected (remote ahead):  
  ```bash
  git pull --rebase
  git push
  ```

### Notes
- Repo URL: `https://github.com/debanga-r-hazarika/Hope.git`
- Keep secrets out of git; `.env` is already ignored.




