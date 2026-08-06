# 圏外 / NO SERVICE ドキュメント

このディレクトリは、Even Realities G2向けインタラクティブノベル「圏外 / NO SERVICE」のプロダクト、物語、実装、評価の正本です。

## 読む順番

1. [コンセプト](./concept.md)
2. [プロダクト要件](./requirements.md)
3. [ストーリーバイブル](./story.md)
4. [アーキテクチャ](./architecture.md)
5. [適応度関数](./fitness.md)
6. [ループエンジニアリング](./loop-engineering.md)

機械可読な正本は[`content/story.json`](../content/story.json)、評価器は[`harness/`](../harness/)に置きます。文章とデータが矛盾した場合、実行時の台詞・遷移は`content/story.json`を優先し、意図と完成条件はこのディレクトリを優先します。
