# 牛牛游戏

## 本地运行

```bash
npm install
npm run dev
```

然后打开 http://localhost:3000

## 部署到 Vercel

### 方法一：Vercel CLI
```bash
npm install -g vercel
vercel
```

### 方法二：GitHub + Vercel（推荐）
1. 把这个文件夹推到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/你的用户名/niuniu.git
   git push -u origin main
   ```
2. 打开 https://vercel.com → New Project → 选择你的 repo → Deploy
3. 完成！Vercel 会自动检测 Next.js，无需额外配置
