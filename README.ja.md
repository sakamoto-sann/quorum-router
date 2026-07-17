# QuorumRouter 日本語ガイド

[English README](README.md) |
[Webサイト](https://sakamoto-sann.github.io/quorum-router/)

QuorumRouterは、複数モデルの回答を比較し、十分な根拠がない場合にはfail
closedするDeno製コントロールプレーンです。旧称は**Fusion
Router**で、独立回答の比較・Judge・Editorによる統合から、明示的なrouting
policy、calibration、Agent Chat、SafeLoop連携へ発展しました。

## 何をするものか

- **Best Route / direct**:
  独立した候補回答を比較し、最適な回答を選択・統合する既定のproduction path
- **Agent Chat**: 異なるprovider/model
  identityが、回数制限付きで相互にレビューする明示opt-in mode
- **Advisory calibration**: callerが提供した外部評価結果を集計する。routing
  authorityは持たない
- **Grounded shadow evaluation**: 選択後の回答を実験的に評価する。production
  routeは変更しない
- **SafeLoop連携**: repository/shell
  mutationのpolicy、approval、execution、receipt生成をSafeLoopへ委譲する

## Fusion Routerからの進化

Fusion
Routerは「複数モデルの回答をどう比較するか」から始まりました。QuorumRouterはその考え方を維持しつつ、次の境界を明確にしています。

1. モデルの議論と外部操作の権限を分離する
2. provider failureや評価不能を成功へ変換しない
3. calibrationやshadow resultを助言情報として扱い、自動的なrouting権限を与えない
4. repository/shell writeはSafeLoopの明示的policy・approval・digest-bound
   receiptがある場合だけ受理する

詳細は[進化パスとSafeLoopの責任分界](docs/evolution.md)を参照してください。

## Quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router
cd my-quorum-router
deno task smoke
```

`deno task smoke`はfixture-onlyで、外部provider
APIを呼びません。実providerのdogfoodは明示的opt-inが必要です。

## 重要な安全境界

- Best Route/directが既定のproduction path
- Agent Chatとexperimental runtimeは自動有効化しない
- QuorumRouterは自分でproposalを承認しない
- SafeLoopがmutation policy、approval、execution、receiptを所有する
- QuorumRouterは正確なaction digestへbindされたverified receiptだけを受理する
- API key、raw private prompt、未匿名化の運用データをrepositoryへ保存しない

## ベンチマークの読み方

[docs/bench.md](docs/bench.md)には実際のOAuth-backed model
callsによる小規模pilotがあります。ただし`n=3`で、rubric coverageはsemantic
correctnessやground truthではありません。コンテンツ最小化aggregateにはraw
prompt、回答本文、task名、case別行を含めません。ただしraw audit artifactとtask
descriptionは同じrepositoryで公開されているため、匿名性を保証するものではありません。

## 開発参加

変更は原則として次の順序で行います。

```text
Issue → Branch → Pull Request → Review → Merge → mainで再検証
```

詳細、必要なcheck、force-push制約は[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## 関連ドキュメント

- [進化パスとSafeLoopの責任分界](docs/evolution.md)
- [AgentRuntime / SafeLoop setup](docs/agent-runtime.md)
- [Benchmark](docs/bench.md)
- [Calibration](docs/calibration.md)
- [Supply-chain maturity](docs/supply-chain.md)
- [Security](docs/security.md)

英語READMEとcode/docsの英語版を仕様上のcanonical
sourceとします。日本語版との不一致がある場合は、英語版と実装・testを優先してください。
