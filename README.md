# G2 Hardware Lab

Even Realities G2と、Even Appを実行するスマートフォンで公開されている入出力APIを一覧的に試すための診断アプリです。SDK 0.0.12を対象にしています。

## 試せる機能

| 対象 | 機能 | 主なAPI |
| --- | --- | --- |
| G2出力 | テキスト、リスト、画像、ページ再構築、差分更新 | `createStartUpPageContainer`, `rebuildPageContainer`, `textContainerUpgrade`, `updateImageRawData` |
| G2 / R1入力 | 押す、2回押す、上スワイプ、下スワイプ、入力元 | `onEvenHubEvent` |
| G2入力 | 4マイクのPCM、IMUのX/Y/Z | `audioControl`, `imuControl` |
| デバイス状態 | 接続、電池、装着、充電、ケース内状態 | `getDeviceInfo`, `onDeviceStatusChanged` |
| スマホ入力 | マイク、位置情報、アルバム、カメラ | `audioControl`, `getAppLocation`, `startAppLocationUpdates`, `pickImageFromAlbum`, `captureImageFromCamera` |
| Even App | 起動元、ユーザー情報、ホスト保存領域 | `onLaunchSource`, `getUserInfo`, `setLocalStorage`, `getLocalStorage` |

G2本体にはカメラとスピーカーがありません。公開SDKにも音声出力、直接Bluetooth、任意ピクセル描画、フォント・文字サイズ変更のAPIはありません。スマホのカメラとアルバムはSDK 0.0.11以降のスマホ側APIです。

## セットアップ

Node.js 20、または22以降が必要です。

```bash
npm install
npm run dev
```

### シミュレータ

別のターミナルで実行します。

```bash
npm run simulator -- "http://localhost:5173/?simulator=true"
```

シミュレータは表示、上下、押す、2回押す、ホストマイクを確認できます。デバイス状態イベントとIMUは実機で確認してください。シミュレータと実機ではフォント、リスト挙動、画像制約に差があります。

### G2実機（QR開発プレビュー）

1. 開発PCとスマートフォンを同じネットワークへ接続します。
2. Even Realities AppでG2をペアリングし、Developer Modeを有効にします。
3. `npm run dev`を起動します。
4. 別ターミナルで`npm run qr`を実行します。
5. Even Hubの開発者メニューからQRコードを読み取ります。

通常のブラウザだけで開いた場合、画面は表示されますがEven AppのネイティブブリッジAPIは実行できません。

### 権限付きパッケージ

マイク、位置、アルバム、カメラの権限は[`app.json`](./app.json)に宣言済みです。パッケージを作る場合は次を実行します。

```bash
npm run pack
```

`g2-hardware-lab.ehpk`が生成されます。APIキーや認証情報はパッケージへ含めないでください。

## 実装上の注意

- G2表示は各眼576 × 288px、4-bitグレースケール（16段階の緑）です。
- ページ内で入力を受けるコンテナは`isEventCapture: 1`の1個だけです。
- 画像更新は並列送信できないため、各送信の完了を待っています。
- マイクPCMは16 kHz、signed 16-bit little-endian、monoです。このアプリはPCMを保存せずレベル計算後に破棄します。
- `ImuReportPace`の100〜1000はプロトコルのペース値で、Hzではありません。
- ルートページの終了には審査要件に合わせて`shutDownPageContainer(1)`を使います。

## 調査元

- [Even Realities Developer Docs: Device APIs](https://hub.evenrealities.com/docs/build/device-apis)
- [Even Realities Developer Docs: Display & UI System](https://hub.evenrealities.com/docs/build/display)
- [Even Realities Developer Docs: Page Lifecycle](https://hub.evenrealities.com/docs/build/page-lifecycle)
- [Even Realities Developer Docs: Packaging & Deployment](https://hub.evenrealities.com/docs/ship/packaging)
- [@evenrealities/even_hub_sdk](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [公式Even Hubテンプレート](https://github.com/even-realities/evenhub-templates)
