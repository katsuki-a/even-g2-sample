# アーキテクチャ

## 方針

物語状態を純粋な状態機械として実装し、Even Hub SDK、DOM、時刻、保存を外側へ追い出す。これにより、全経路をG2なしで走査し、同じ入力列から同じ終端を再現できるようにする。

```text
                 content/story.json
                         |
                         v
 Input Adapter -> Story Engine -> View Model -> Glasses Renderer
 (G2 / R1)         |   ^                         |       |
                   v   |                         v       v
                Progress Store              Text SDK  Image Queue
                   ^
                   |
                Clock Port
```

## 目標ディレクトリ

```text
src/
  main.ts                  # 依存の組み立てと起動だけ
  app/controller.ts        # 入力、状態遷移、描画の調停
  content/load-story.ts    # JSONの読み込みと実行時モデル化
  domain/story.ts          # Story、Node、Choice型
  domain/engine.ts         # 純粋な遷移関数
  domain/progress.ts       # 保存可能な進行状態
  domain/view-model.ts     # G2表示用データへの純粋変換
  platform/even-input.ts   # SDKイベントを論理操作へ正規化
  platform/even-renderer.ts# ページ作成、差分更新、終了
  platform/image-queue.ts  # 画像送信の直列化と再試行
  platform/storage.ts      # Even App local storage adapter
  platform/clock.ts        # 実時刻とテスト時刻
  ui/phone.ts              # 設定、診断、デバッグ
  assets/story/            # 1-bit添付画像
```

## ドメインモデル

```ts
type Progress = {
  storyId: string
  currentNodeId: string
  visitedNodeIds: string[]
  choices: Record<string, string>
  flags: string[]
  rapport: number
  revision: number
}

type Command =
  | { type: 'ADVANCE' }
  | { type: 'MOVE_SELECTION'; delta: -1 | 1 }
  | { type: 'CONFIRM_CHOICE' }
  | { type: 'BACK' }
  | { type: 'RETRY_ATTACHMENT' }

type Transition = {
  progress: Progress
  effect?: 'SAVE' | 'SHOW_ATTACHMENT' | 'EXIT'
}
```

`reduceStory(story, progress, command)`は副作用を持たない。保存、画像送信、時刻待機はControllerが`Transition`を解釈して実行する。

## ノード種別

| 種別 | 用途 | 描画 |
| --- | --- | --- |
| `mail` | 日時、差出人、件名、本文 | テキスト差分更新 |
| `choice` | 2〜3個の返信候補 | リストページへ再構築 |
| `attachment` | 画像と短いキャプション | 画像ページへ再構築後、直列送信 |
| `system` | 接続、削除、復元など | システム用テキスト差分更新 |
| `ending` | 第1話の終端 | 終了選択を持つテキストページ |

## G2ページ

### MailPage

- Status: 時刻、電波表示、電池
- Header: 差出人、件名、送信日時
- Body: 本文
- Capture: 透明または最小テキストコンテナ1個

本文更新だけなら`textContainerUpgrade`を使い、メールごとの全再構築を避ける。

### ChoicePage

- Header: `返信を選択`
- List: 2〜3項目
- Capture: リストコンテナ

### AttachmentPage

- Header: ファイル名、容量
- Image: 200×100の画像コンテナ
- Caption: 1〜2行
- Capture: テキストコンテナ

`updateImageRawData`は必ずキューを通し、同時送信しない。

## 入力正規化

| 物理入力 | 論理操作 |
| --- | --- |
| 上スワイプ | `MOVE_SELECTION(-1)`または前項目 |
| 下スワイプ | `MOVE_SELECTION(1)`または次項目 |
| タップ | `ADVANCE`または`CONFIRM_CHOICE` |
| ダブルタップ | `BACK`。必須進行には使わない |
| システム終了 | 進行保存後に終了 |

G2左右テンプルとR1は入力元を記録しても、MVPの物語結果には影響させない。

## 保存

- 保存単位は選択確定後とノード表示成功後。
- 一時的な選択カーソル位置は保存しない。
- `revision`で将来のマイグレーションを行う。
- 読み込み失敗時はデータを削除せず、初期状態と復旧メッセージを表示する。
- 開発時はインメモリStorageへ差し替える。

## 時刻

実時刻は台詞テンプレートの`{{currentYear}}`、ステータスバー、待ち時間だけに使う。物語遷移そのものを実時刻で分岐させない。Clockを注入し、自動テストでは固定時刻を使用する。

## エラー処理

| エラー | 振る舞い |
| --- | --- |
| ブリッジ未接続 | スマホ側に説明し、G2操作を無効化 |
| 画像送信失敗 | 本文は維持し、`再受信`を選択可能にする |
| 保存失敗 | セッションを継続し、画面へ非破壊の警告 |
| 不明ノード | 最後の正常ノードへ戻し、診断IDを表示 |
| WebView再生成 | 保存済みノードからページを再構築 |

## Hardware Labからの移行

既存のAPI確認コードを一度に書き換えない。

1. 画像BMP処理を`platform/image-queue.ts`へ移す。
2. イベント正規化を`platform/even-input.ts`へ移す。
3. 純粋なStory Engineを追加し、ブラウザなしでテストする。
4. 新Rendererを追加してHardware Lab UIと並行検証する。
5. 製品フローが実機で通った後、未使用の診断UIと権限を削除する。

## テスト境界

- **Unit:** 遷移、テンプレート展開、保存マイグレーション、入力正規化
- **Graph:** 全経路、到達可能性、終端、表示長、ビート順序
- **Integration:** Fake Bridgeによるページ作成、画像キュー、再接続
- **Simulator:** 表示、選択、添付、終了
- **Hardware:** フォント、画像、R1、ロック、再起動、アイドル復帰
