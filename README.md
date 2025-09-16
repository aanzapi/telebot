# 🤖 Telegram Bot Uploader ke GitHub

Bot Telegram untuk upload file `.zip` langsung ke GitHub.  
Fitur:
- `/upload namarepo` → upload file `.zip` (dikirim via reply), diekstrak lalu di-push ke GitHub.  
- `/listrepo` → lihat daftar repo GitHub.  
- `/delete namarepo` → hapus repo GitHub.  

---

## 🚀 Instalasi di Termux / VPS

### 1. Install Node.js & Git
```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
