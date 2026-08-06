# 圏外 / NO SERVICE

[![CI](https://github.com/katsuki-a/even-g2-sample/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/katsuki-a/even-g2-sample/actions/workflows/ci.yml)
[![Fitness](https://img.shields.io/endpoint?url=https%3A%2F%2Fkatsuki-a.github.io%2Feven-g2-sample%2Fbadges%2Ffitness.json)](./docs/fitness.md)
[![GitHub Pages](https://github.com/katsuki-a/even-g2-sample/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/katsuki-a/even-g2-sample/actions/workflows/deploy-pages.yml)

> 最先端の眼鏡に、2008年の携帯メールが届く。

Even Realities G2向けの短編インタラクティブノベルです。G2の緑色表示、上下・決定中心の入力、小さなモノクロ画像を、2008年から届く携帯メールという物語体験へ変換しています。

[ブラウザで第1話「届いてる？」を試す](https://katsuki-a.github.io/even-g2-sample/)

ブラウザ版はG2がなくても最後までプレイできます。進行状況はブラウザ内へ保存されます。

## 現在の状態

- 第1話を実装済み。28ノード、27経路、3エンディングを収録しています。
- active phaseは`implementation`です。適応度スコアは上部のFitnessバッジへ自動反映されます。
- 自動テスト、全経路検査、シミュレータ検証は完了しています。
- G2 / R1実機の全項目検証と5人ユーザーテストは未完了です。リリース判定の詳細は[リリース検証手順](./docs/release-validation.md)を参照してください。

## 主な特徴

| 項目 | 内容 |
| --- | --- |
| ストーリー | 推敲済みの分岐シナリオを`content/story.json`で管理 |
| 操作 | G2 / R1入力を上・下・決定・戻るへ正規化 |
| 添付画像 | 200 × 100pxの1-bit BMPを直列送信し、失敗時に再試行 |
| 復元 | 選択と現在位置を保存し、WebView再生成後も再開 |
| ブラウザ対応 | G2ブリッジがない環境では同じ物語を電話側プレビューで実行 |
| 最小権限 | ネットワーク、マイク、位置情報、カメラ、アルバム権限を不使用 |
| 品質評価 | Story、Docs、Architecture、Release Evidenceを段階別に100点評価 |

## 必要環境

- Node.js 20.19以上、または22.12以上
- npm
- G2連携を試す場合はEven Realities AppのDeveloper Mode

## セットアップ

```bash
git clone https://github.com/katsuki-a/even-g2-sample.git
cd even-g2-sample
npm ci
npm run dev
```

開発サーバーは`http://localhost:5173`で起動します。ブラウザでは画面上のボタン、または`↑` / `↓` / `Enter` / `Esc`で操作できます。

### Even Hubシミュレータ

開発サーバーを起動したまま、別のターミナルで実行します。

```bash
npm run simulator -- "http://localhost:5173/?simulator=true"
```

### G2実機（QR開発プレビュー）

1. 開発PCとスマートフォンを同じネットワークへ接続します。
2. Even Realities AppでG2をペアリングし、Developer Modeを有効にします。
3. `npm run dev`を起動します。
4. 別のターミナルで`npm run qr`を実行します。
5. Even Hubの開発者メニューからQRコードを読み取ります。

配布パッケージは`npm run pack`で`no-service.ehpk`として生成できます。

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

変更を渡す前の基準コマンドは次です。

```bash
npm run loop:check
```

## アーキテクチャ

物語遷移はDOMやEven Hub SDKへ依存しない純粋な状態機械です。外部I/OをPortとして分離し、同じ選択列から同じ終端へ到達することをブラウザなしで検査します。

```text
content/story.json
        |
        v
Input -> Story Engine -> View Model -> Phone / G2 Renderer
              |                              |
              v                              v
        Progress Store                  Image Queue
```

詳細は[アーキテクチャ](./docs/architecture.md)、プロダクト全体の意図と完成条件は[ドキュメント一覧](./docs/README.md)を参照してください。

## CI/CDとFitnessバッジ

- `push`と`pull_request`でCIが`npm run loop:check`を実行します。
- `main`へのpushで同じ検証を通過した`dist/`をGitHub Pagesへデプロイします。
- デプロイ時にactive phaseを再評価し、`dist/badges/fitness.json`へShields.io互換のバッジデータを生成します。
- 初回のみ、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。

Fitness Harnessの基準、重み、ハードゲートは[適応度関数](./docs/fitness.md)に記載しています。
