---
status: accepted
---

# 第一版使用可逆的可读语义名称

GSS-l 第一版优先调试性与语义验证，使用由完整 canonical identity 可逆编码得到的可读 class/resource名称，不以 hash或全局递增短名优化体积。名称分配封装在独立 `NameAllocator` port后，待项目语义、真实 corpus 和体积数据稳定，再评估 Tailwind 风格语义短名、digest/hash或混合方案。

## Consequences

- 名称包含类型 namespace 与完整必要 identity，例如 declaration condition/property/value、marker的项目相对 Module/path/relation、keyframes的 Module/name；不依赖 registry到达顺序。
- Serializer 对非安全字符使用确定、无歧义、可逆的 CSS identifier encoding；不截断、不用碰撞后缀计数，因此相同 identity稳定、不同 identity不因 slug归一化碰撞。
- 项目相对 logical Module id可以进入 local marker/resource名称，绝对 cwd、时间戳和随机值不得进入。
- 第一版接受 arbitrary value、URL或复杂 condition导致名称较长的体积代价，并通过 manifest/report测量 CSS、JS和 HTML class成本。
- Semantic identity与最终 emitted name严格分离；未来替换 NameAllocator不得改变 resolver、registry identity、manifest source关系或 public authored API。
