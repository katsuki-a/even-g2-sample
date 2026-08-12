# Even G2 Interactive Experience

[![CI](https://github.com/katsuki-a/even-g2-sample/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/katsuki-a/even-g2-sample/actions/workflows/ci.yml)
[![Fitness](https://img.shields.io/endpoint?url=https%3A%2F%2Fkatsuki-a.github.io%2Feven-g2-sample%2Fbadges%2Ffitness.json)](./docs/fitness.md)
[![Fitness deployment](https://github.com/katsuki-a/even-g2-sample/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/katsuki-a/even-g2-sample/actions/workflows/deploy-pages.yml)

Even Realities G2の緑色の画面を活かした、インタラクティブ体験のプロトタイプです。

制約のある表示領域と入力デバイスに合わせたUI設計、状態管理、1-bit画像転送、再開処理を実装しています。また、実装品質を継続的に評価するため、テストと独自の適応度関数をCIへ組み込んでいます。

このプロジェクトは開発を終了し、ポートフォリオとしてアーカイブしています。公開サンプルは提供していません。

## 技術的なポイント

| 項目 | 内容 |
| --- | --- |
| デバイスUI | G2 / R1の入力を上・下・決定・戻るの論理操作へ正規化 |
| G2レンダリング | テキストページの再構築と差分更新をEven Hub SDK経由で制御 |
| 画像処理 | 200 × 100 pxの1-bit BMPを生成し、送信キューで直列転送 |
| 状態管理 | 表示位置と選択を保存し、WebViewの再生成後も復元 |
| 関心の分離 | ドメインロジックをDOM、SDK、時刻、ストレージから分離 |
| 品質評価 | テスト、全経路検査、構造評価、リリース証跡を段階別に検証 |
| 最小権限 | ネットワーク、マイク、位置情報、カメラ、アルバム権限を不使用 |

## アーキテクチャ

状態遷移を副作用のないドメインロジックとして実装し、入力、描画、永続化、画像転送をアダプターとして分離しています。これにより、G2へ接続せずに主要な遷移を自動検証できます。

```text
content/story.json
        |
        v
Input -> Domain Engine -> View Model -> Phone / G2 Renderer
              |                              |
              v                              v
        Progress Store                  Image Queue
```

詳細は[アーキテクチャ](./docs/architecture.md)を参照してください。

## 必要環境

- Node.js 20.19以上、または22.12以上
- npm
- G2連携を試す場合はEven Realities AppのDeveloper Mode

## ローカルでの実行

```bash
git clone https://github.com/katsuki-a/even-g2-sample.git
cd even-g2-sample
npm ci
npm run dev
```

開発サーバーは`http://localhost:5173`で起動します。

Even Hubシミュレータを利用する場合は、開発サーバーを起動したまま別のターミナルで次を実行します。

```bash
npm run simulator -- "http://localhost:5173/?simulator=true"
```

## 開発と検証

| コマンド | 内容 |
| --- | --- |
| `npm test` | ドメイン、プラットフォーム、Fitness Harnessのテスト |
| `npm run fitness` | active phaseの適応度評価 |
| `npm run fitness:implementation` | implementation評価 |
| `npm run fitness:release` | release評価（実機・ユーザーテスト証拠を含む） |
| `npm run build` | strict TypeScript検査とVite本番ビルド |
| `npm run loop:check` | テスト、active phase評価、本番ビルドを一括実行 |
| `npm run simulator:evidence` | シミュレータの構造化証跡を取得 |

変更を検証する基準コマンドは次のとおりです。

```bash
npm run loop:check
```

## CI/CDとFitnessバッジ

- `push`と`pull_request`でCIが`npm run loop:check`を実行します。
- `main`へのpushで同じ検証とactive phaseの再評価を実行します。
- 評価結果はShields.io互換のJSONとしてGitHub Pagesへデプロイし、上部のFitnessバッジへ反映します。

Fitness Harnessの基準、重み、ハードゲートは[適応度関数](./docs/fitness.md)に記載しています。
