// 数学公式速查
export const mathFormulas = [
  {
    id: 'math-1',
    name: '极限的计算',
    subject: 'math',
    category: '高等数学',
    content: `两个重要极限：
1. lim(x→0) sin(x)/x = 1
2. lim(x→∞) (1 + 1/x)^x = e

等价无穷小（x→0）：
sin(x) ~ x
tan(x) ~ x
arcsin(x) ~ x
arctan(x) ~ x
ln(1+x) ~ x
e^x - 1 ~ x
1 - cos(x) ~ x²/2
(1+x)^α - 1 ~ αx

洛必达法则：
若 lim f(x) = 0, lim g(x) = 0（或都为∞）
则 lim f(x)/g(x) = lim f'(x)/g'(x)`,
    description: '极限计算的核心公式和方法。',
    example: `求 lim(x→0) (e^x - 1)/sin(x)
= lim(x→0) x/x = 1`
  },
  {
    id: 'math-2',
    name: '导数公式表',
    subject: 'math',
    category: '高等数学',
    content: `基本导数公式：
(c)' = 0
(x^n)' = nx^(n-1)
(sin x)' = cos x
(cos x)' = -sin x
(tan x)' = sec²x
(cot x)' = -csc²x
(sec x)' = sec x · tan x
(csc x)' = -csc x · cot x
(a^x)' = a^x · ln a
(e^x)' = e^x
(log_a x)' = 1/(x · ln a)
(ln x)' = 1/x
(arcsin x)' = 1/√(1-x²)
(arccos x)' = -1/√(1-x²)
(arctan x)' = 1/(1+x²)
(arccot x)' = -1/(1+x²)

复合函数求导：
[f(g(x))]' = f'(g(x)) · g'(x)`,
    description: '常用函数的导数公式。'
  },
  {
    id: 'math-3',
    name: '积分公式表',
    subject: 'math',
    category: '高等数学',
    content: `基本积分公式：
∫x^n dx = x^(n+1)/(n+1) + C (n≠-1)
∫1/x dx = ln|x| + C
∫e^x dx = e^x + C
∫a^x dx = a^x/ln(a) + C
∫sin x dx = -cos x + C
∫cos x dx = sin x + C
∫tan x dx = -ln|cos x| + C
∫cot x dx = ln|sin x| + C
∫sec x dx = ln|sec x + tan x| + C
∫csc x dx = ln|csc x - cot x| + C
∫1/(1+x²) dx = arctan x + C
∫1/√(1-x²) dx = arcsin x + C
∫1/√(a²-x²) dx = arcsin(x/a) + C
∫1/√(x²±a²) dx = ln|x + √(x²±a²)| + C`,
    description: '常用函数的不定积分公式。'
  },
  {
    id: 'math-4',
    name: '中值定理',
    subject: 'math',
    category: '高等数学',
    content: `罗尔定理：
若 f(x) 在 [a,b] 连续，在 (a,b) 可导，且 f(a)=f(b)
则 ∃ξ∈(a,b)，使 f'(ξ) = 0

拉格朗日中值定理：
若 f(x) 在 [a,b] 连续，在 (a,b) 可导
则 ∃ξ∈(a,b)，使 f(b)-f(a) = f'(ξ)(b-a)

柯西中值定理：
若 f(x), g(x) 在 [a,b] 连续，在 (a,b) 可导，g'(x)≠0
则 ∃ξ∈(a,b)，使 [f(b)-f(a)]/[g(b)-g(a)] = f'(ξ)/g'(ξ)

泰勒公式：
f(x) = f(x₀) + f'(x₀)(x-x₀) + f''(x₀)(x-x₀)²/2! + ...
      + f^(n)(x₀)(x-x₀)^n/n! + R_n(x)`,
    description: '微分中值定理的核心内容。'
  },
  {
    id: 'math-5',
    name: '多元函数微分学',
    subject: 'math',
    category: '高等数学',
    content: `全微分：
若 z = f(x,y)，则
dz = ∂z/∂x · dx + ∂z/∂y · dy

链式法则：
设 z = f(u,v), u = φ(x,y), v = ψ(x,y)
则 ∂z/∂x = ∂f/∂u · ∂u/∂x + ∂f/∂v · ∂v/∂x
   ∂z/∂y = ∂f/∂u · ∂u/∂y + ∂f/∂v · ∂v/∂y

隐函数求导：
若 F(x,y,z) = 0 确定 z = z(x,y)
则 ∂z/∂x = -F_x/F_z
   ∂z/∂y = -F_y/F_z

方向导数：
∂f/∂l = f_x · cos α + f_y · cos β
其中 (cos α, cos β) 是方向余弦

梯度：
grad f = (f_x, f_y) 或 (f_x, f_y, f_z)`,
    description: '多元函数微分学的核心公式。'
  },
  {
    id: 'math-6',
    name: '重积分计算',
    subject: 'math',
    category: '高等数学',
    content: `二重积分：
直角坐标：
∬_D f(x,y) dA = ∫∫ f(x,y) dx dy

极坐标：
x = r cos θ, y = r sin θ
∬_D f(x,y) dA = ∫∫ f(r cos θ, r sin θ) r dr dθ

三重积分：
直角坐标：
∭_Ω f(x,y,z) dV = ∫∫∫ f(x,y,z) dx dy dz

柱坐标：
x = r cos θ, y = r sin θ, z = z
∭_Ω f dV = ∫∫∫ f(r cos θ, r sin θ, z) r dr dθ dz

球坐标：
x = ρ sin φ cos θ
y = ρ sin φ sin θ
z = ρ cos φ
∭_Ω f dV = ∫∫∫ f(ρ sin φ cos θ, ρ sin φ sin θ, ρ cos φ) ρ² sin φ dρ dφ dθ`,
    description: '重积分的计算方法。'
  },
  {
    id: 'math-7',
    name: '行列式性质',
    subject: 'math',
    category: '线性代数',
    content: `行列式的基本性质：
1. 行列式转置，值不变：|A^T| = |A|
2. 互换两行（列），行列式变号
3. 某行（列）的公因子可以提出
4. 两行（列）成比例，行列式为0
5. 行列式按行（列）展开

行列式的计算：
|AB| = |A| · |B|
|kA| = k^n · |A| （A为n阶矩阵）
|A^(-1)| = 1/|A|
|A^*| = |A|^(n-1)

克拉默法则：
若 |A| ≠ 0，则方程组 Ax = b 有唯一解
x_i = |A_i| / |A|
其中 A_i 是将 A 的第 i 列替换为 b`,
    description: '行列式的性质和计算方法。'
  },
  {
    id: 'math-8',
    name: '矩阵运算',
    subject: 'math',
    category: '线性代数',
    content: `矩阵的基本运算：
(A + B)^T = A^T + B^T
(AB)^T = B^T · A^T
(AB)^(-1) = B^(-1) · A^(-1)
(A^T)^(-1) = (A^(-1))^T

矩阵的秩：
r(A) = A 的最高阶非零子式的阶数
r(AB) ≤ min{r(A), r(B)}
r(A+B) ≤ r(A) + r(B)

逆矩阵：
AA^(-1) = A^(-1)A = E
A^(-1) = A^* / |A| （|A| ≠ 0）

伴随矩阵：
AA^* = A^*A = |A|E
(A^*)^(-1) = (A^(-1))^* = A / |A|`,
    description: '矩阵运算的核心公式。'
  },
  {
    id: 'math-9',
    name: '特征值与特征向量',
    subject: 'math',
    category: '线性代数',
    content: `特征值和特征向量的定义：
Ax = λx （x ≠ 0）
其中 λ 是特征值，x 是对应的特征向量

特征方程：
|A - λE| = 0

特征值的性质：
1. tr(A) = λ₁ + λ₂ + ... + λ_n （迹）
2. |A| = λ₁ · λ₂ · ... · λ_n
3. 若 A 可逆，则 λ_i ≠ 0

相似矩阵：
若 P^(-1)AP = B，则 A ~ B
相似矩阵有相同的特征值

实对称矩阵：
1. 特征值都是实数
2. 不同特征值的特征向量正交
3. 必可对角化`,
    description: '特征值和特征向量的核心内容。'
  },
  {
    id: 'math-10',
    name: '二次型',
    subject: 'math',
    category: '线性代数',
    content: `二次型的矩阵表示：
f(x₁, x₂, ..., x_n) = x^T A x
其中 A 是实对称矩阵

标准形：
f = d₁y₁² + d₂y₂² + ... + d_ny_n²

规范形：
f = z₁² + z₂² + ... + z_p² - z_(p+1)² - ... - z_(p+q)²

惯性定理：
正惯性指数 p 和负惯性指数 q 是唯一的

正定性的判定：
1. 所有特征值 > 0
2. 各阶顺序主子式 > 0
3. 正惯性指数 = n`,
    description: '二次型的标准形和正定性判定。'
  },
  {
    id: 'math-11',
    name: '概率基本公式',
    subject: 'math',
    category: '概率论',
    content: `概率的基本性质：
0 ≤ P(A) ≤ 1
P(Ω) = 1, P(∅) = 0
P(A∪B) = P(A) + P(B) - P(AB)

条件概率：
P(B|A) = P(AB) / P(A)

乘法公式：
P(AB) = P(A) · P(B|A) = P(B) · P(A|B)

全概率公式：
P(B) = Σ P(A_i) · P(B|A_i)

贝叶斯公式：
P(A_j|B) = P(A_j) · P(B|A_j) / Σ P(A_i) · P(B|A_i)

事件的独立性：
若 P(AB) = P(A) · P(B)，则 A、B 独立`,
    description: '概率论的基本公式。'
  },
  {
    id: 'math-12',
    name: '常见分布',
    subject: 'math',
    category: '概率论',
    content: `离散型分布：
1. 0-1分布：P(X=k) = p^k(1-p)^(1-k), k=0,1
   E(X) = p, D(X) = p(1-p)

2. 二项分布 X~B(n,p)：
   P(X=k) = C(n,k)p^k(1-p)^(n-k)
   E(X) = np, D(X) = np(1-p)

3. 泊松分布 X~P(λ)：
   P(X=k) = λ^k e^(-λ) / k!
   E(X) = λ, D(X) = λ

连续型分布：
1. 均匀分布 X~U(a,b)：
   f(x) = 1/(b-a), a≤x≤b
   E(X) = (a+b)/2, D(X) = (b-a)²/12

2. 正态分布 X~N(μ,σ²)：
   f(x) = (1/√(2πσ²))e^(-(x-μ)²/(2σ²))
   E(X) = μ, D(X) = σ²

3. 指数分布 X~E(λ)：
   f(x) = λe^(-λx), x≥0
   E(X) = 1/λ, D(X) = 1/λ²`,
    description: '常见概率分布及其数字特征。'
  },
  {
    id: 'math-13',
    name: '数字特征',
    subject: 'math',
    category: '概率论',
    content: `数学期望：
离散型：E(X) = Σ x_i · p_i
连续型：E(X) = ∫ x · f(x) dx

性质：
E(aX+b) = aE(X) + b
E(X±Y) = E(X) ± E(Y)
若 X,Y 独立，则 E(XY) = E(X)·E(Y)

方差：
D(X) = E[(X-E(X))²] = E(X²) - [E(X)]²

性质：
D(aX+b) = a²D(X)
若 X,Y 独立，则 D(X±Y) = D(X) + D(Y)

协方差：
Cov(X,Y) = E[(X-E(X))(Y-E(Y))]
         = E(XY) - E(X)E(Y)

相关系数：
ρ_XY = Cov(X,Y) / √(D(X)·D(Y))
|ρ_XY| ≤ 1`,
    description: '随机变量的数字特征。'
  },
  {
    id: 'math-14',
    name: '大数定律和中心极限定理',
    subject: 'math',
    category: '概率论',
    content: `切比雪夫大数定律：
设 X₁,X₂,...独立，E(X_i)=μ_i, D(X_i)≤C
则对任意 ε>0，
lim(n→∞) P(|X̄_n - μ̄_n| < ε) = 1

辛钦大数定律：
设 X₁,X₂,...独立同分布，E(X_i)=μ
则 X̄_n → μ (依概率收敛)

林德伯格-列维中心极限定理：
设 X₁,X₂,...独立同分布，E(X_i)=μ, D(X_i)=σ²
则 (ΣX_i - nμ)/(σ√n) → N(0,1) (依分布收敛)

棣莫弗-拉普拉斯中心极限定理：
设 X~B(n,p)，则
(X-np)/√(np(1-p)) → N(0,1) (依分布收敛)`,
    description: '大数定律和中心极限定理。'
  },
  {
    id: 'math-15',
    name: '参数估计',
    subject: 'math',
    category: '数理统计',
    content: `矩估计法：
用样本矩估计总体矩
Â_k = (1/n)ΣX_i^k （样本k阶原点矩）

最大似然估计法：
1. 写出似然函数 L(θ) = Π f(x_i;θ)
2. 取对数 ln L(θ)
3. 对 θ 求导，令导数为0
4. 解方程得 θ̂

估计量的评价标准：
1. 无偏性：E(θ̂) = θ
2. 有效性：D(θ̂₁) < D(θ̂₂)
3. 一致性：θ̂ → θ (依概率收敛)

置信区间：
P(θ̂₁ < θ < θ̂₂) = 1 - α
其中 1-α 是置信度`,
    description: '参数估计的方法。'
  }
]
