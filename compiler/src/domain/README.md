# Compiler domain 设计入口

本目录实现框架无关的 CSS 语义与排序。修改属性效果、声明覆盖、排序或 atom 复用之前，先读 [属性展开、原子排序与复用](../../../docs/PROPERTY-ORDER-DESIGN.md)，其中记录已确认的语义、示例、验证要求与未完成的目标。修改整体阶段或边界时另读 [核心工作流与架构方向](../../../docs/ARCHITECTURE-DIRECTION.md)。两篇文档区分当前实现和目标，不应把目标当成已交付能力。

| 工作 | 现有入口 | 必须区分的语义 |
| --- | --- | --- |
| 属性写入与重置 | [property-effects.ts](property-effects.ts)、[expand-safe-margin.ts](expand-safe-margin.ts) | shorthand 与 longhand 对同一 effect 的竞争按原生强度和声明顺序处理；安全展开与保留原声明各有边界。 |
| 胜出和语义关系 | [resolve-target-declarations.ts](resolve-target-declarations.ts)、[semantic-order-heights.ts](semantic-order-heights.ts) | 按 effect 判断部分胜出；已证明的 ownership／结构关系与原生强度都不能被简单属性排序替代。 |
| 模块内排序和复用 | [fixed-module-ranks.ts](fixed-module-ranks.ts)、[rule-order-planner.ts](rule-order-planner.ts) | rank 保留必要的竞争顺序和 scope membership；相同值不一定可跨竞争者复用。当前 rank 仍按潜在重叠族规划，独立同属性 rank 是目标。 |
| 方向别名与准入 | [module-order-policy.ts](module-order-policy.ts)、[validate-logical-physical-conflicts.ts](validate-logical-physical-conflicts.ts) | 逻辑／物理潜在重叠与 shorthand 的确定包含关系不同；潜在别名不构成确定覆盖或删除证明。 |

实施或修改这些决策时，在上述权威设计文档中同步记录原因、适用范围、反例及验证；新增功能前先核实当前准入、fallback 和资源／来源身份，避免将目标推广到尚未证明的情况。
