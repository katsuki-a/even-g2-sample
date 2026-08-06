# Iteration 2026-08-06-01

## 仮説

企画意図を機械可読な物語グラフと段階別適応度へ落とせば、Hardware Labから製品へ移行する際に「次に直すべき最大の不足」を自動で特定できる。

## 対象

- 種別: story / architecture
- 適応度項目: Story、Docs、Architecture、Release Evidence
- 変更前スコア: 評価器なし

## 変更

- コンセプト、要件、ストーリー、アーキテクチャ、適応度、ループ手順を`docs/`へ定義した。
- 第1話を24ノード、27経路、3終端の`content/story.json`へ変換した。
- concept / implementation / releaseの段階別評価器と回帰テストを追加した。
- 既存Hardware Labの実装と未コミット変更は変更対象にしなかった。

## 自動評価

```text
npm run loop:check
npm run fitness:implementation
npm run fitness:release
```

- concept: 100/100、PASS
- implementation: 45/100、FAIL（Architecture 0/100）
- release: 30/100、FAIL（ArchitectureとEvidenceが未完了）
- Story: 100/100、24ノード、27経路、3終端、全経路14ノード
- Test: 5件成功
- Build: TypeScript / Vite成功
- Warning: `PIC_0047.BMP`は計画状態

## 人手確認

- 環境: 文書・CLIのみ
- 観察: ストーリーの全経路は機械検査済み。シミュレータと実機は未実施。
- 証拠: このログと`harness/evidence.json`

## 判断

- 採用
- concept段階は完成。次の最大リスクがStory Engine不在と810行の`src/main.ts`に明確化された。
- 次の仮説: 先に純粋なStory Engineと全経路テストを実装すれば、G2 Rendererの変更を安全に反復できる。
