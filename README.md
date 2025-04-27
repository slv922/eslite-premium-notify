# eslite-premium-notify

誠品會員通知系統

## 專案簡介

這個專案是誠品會員通知系統，提供會員查詢候補狀態、推播通知等功能。前端採用 Vue 3 + Vite + TypeScript，後端 API 也用 TypeScript 開發。

## 主要功能
- 查詢會員候補狀態
- 會員通知推播
- 前端 UI 互動

## 技術棧
- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## 專案結構
```
├── src/                # 前端原始碼
│   ├── components/     # Vue 元件
│   ├── composables/    # 可重複使用邏輯
│   ├── types/          # 型別定義
│   └── main.ts         # 入口檔案
├── api/                # API 端點
├── package.json        # 專案設定
├── vite.config.ts      # Vite 設定
└── ...
```

## 安裝與啟動

1. 安裝套件：
   ```sh
   npm install
   ```
2. 啟動開發伺服器：
   ```sh
   npm run dev
   ```
3. 打包專案：
   ```sh
   npm run build
   ```

## 環境變數
請在專案根目錄建立 `.env` 檔案，並依需求設定相關變數。

## 貢獻方式
歡迎提出 PR 或 issue，請遵守專案規範。

## 授權
MIT License
