import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const candidateRoot = path.join(root, "data/candidates/knowledge-v5-concept-accounting-20260723");
const outputPath = path.join(candidateRoot, "aqa-local-review.json");

const ontologyAdditions = [
  {
    nodeId: "NUMM-ODE-EULR-EXPL",
    parentNodeId: "NUMM-ODE",
    name: "Euler Method",
    definition:
      "Approximating a first-order initial-value problem with the explicit Euler update yₙ₊₁ = yₙ + h f(xₙ, yₙ), using one slope evaluation per step.",
    aliases: ["ordinary Euler method", "Euler's step-by-step method", "explicit Euler method"],
    dimension: "not-applicable",
    objectScopes: ["first-order initial-value problems"],
    inclusions: ["single-slope Euler update", "stepwise numerical solution"],
    exclusions: ["improved Euler method", "modified Euler method", "Runge-Kutta methods"],
    semanticClass: "mathematical-knowledge",
    comparisonEligible: true,
    stageDepth: ["a_level", "further"],
    sourceHints: ["AQA-7367"],
    reviewStatus: "codex-reviewed",
    reviewNotes: [
      "The active ontology had only an Improved Euler node whose exclusions explicitly reject ordinary Euler.",
      "A distinct leaf is required to represent AQA 7367 J2 without a false concept link.",
    ],
  },
  {
    nodeId: "PROB-DRVD-DRVB-MODE",
    parentNodeId: "PROB-DRVD-DRVB",
    name: "Mode of a Discrete Random Variable",
    definition:
      "A value of a discrete random variable having the greatest probability mass; more than one mode may occur.",
    aliases: ["mode of a discrete distribution", "modal value of a DRV"],
    dimension: "not-applicable",
    objectScopes: ["discrete random variables", "probability mass functions"],
    inclusions: ["identifying a most probable value", "multiple modes"],
    exclusions: ["sample-data mode without a probability model", "continuous density modes"],
    semanticClass: "mathematical-knowledge",
    comparisonEligible: true,
    stageDepth: ["a_level", "further"],
    sourceHints: ["AQA-7367"],
    reviewStatus: "codex-reviewed",
    reviewNotes: ["The official statement explicitly assesses the mode of a discrete random variable."],
  },
  {
    nodeId: "PROB-DRVD-DRVB-MEDI",
    parentNodeId: "PROB-DRVD-DRVB",
    name: "Median of a Discrete Random Variable",
    definition:
      "A value locating the 0.5 probability quantile of a discrete random variable, determined from cumulative probability.",
    aliases: ["median of a discrete distribution", "DRV median"],
    dimension: "not-applicable",
    objectScopes: ["discrete random variables", "cumulative probability"],
    inclusions: ["0.5 quantile", "median from cumulative mass"],
    exclusions: ["sample-data median without a probability model", "continuous-distribution median"],
    semanticClass: "mathematical-knowledge",
    comparisonEligible: true,
    stageDepth: ["a_level", "further"],
    sourceHints: ["AQA-7367"],
    reviewStatus: "codex-reviewed",
    reviewNotes: ["The official statement explicitly assesses the median of a discrete random variable."],
  },
  {
    nodeId: "PROB-DIST-EXPO-MEAN",
    parentNodeId: "PROB-DIST",
    name: "Exponential Distribution Moments",
    definition:
      "For an exponential distribution with rate λ, the mean is 1/λ and the variance is 1/λ², with standard deviation 1/λ.",
    aliases: ["exponential mean and variance", "exponential distribution moments"],
    dimension: "not-applicable",
    objectScopes: ["exponential random variables"],
    inclusions: ["E(X) = 1/λ", "Var(X) = 1/λ²", "standard deviation 1/λ"],
    exclusions: ["Poisson moments", "generic continuous moments without the exponential model"],
    semanticClass: "mathematical-knowledge",
    comparisonEligible: true,
    stageDepth: ["a_level", "further"],
    sourceHints: ["AQA-7367"],
    reviewStatus: "codex-reviewed",
    reviewNotes: ["The active exponential-distribution branch lacked a leaf for its explicit moments."],
  },
];

const additions = [
  // AQA A-level Mathematics 7357.
  ["AQA-7357:1.3", "AQA-7357-B3", "ALGF-FUNC-GRAP-QUAD", "exact", "application", "quadratic functions and their graphs"],
  ["AQA-7357:1.3", "AQA-7357-B3", "ALGF-EQN-QUAD-DISC", "exact", "application", "the discriminant of a quadratic function"],
  ["AQA-7357:1.3", "AQA-7357-B6-1", "ALGF-EXP-MANI-EXP2", "partial", "application", "expanding brackets"],
  ["AQA-7357:1.3", "AQA-7357-B6-1", "ALGF-POLY-POLY-DIVL", "exact", "application", "simple algebraic division"],
  ["AQA-7357:1.3", "AQA-7357-B6-2", "ALGF-EXP-MANI-AFRA", "exact", "application", "Simplify rational expressions"],
  ["AQA-7357:1.3", "AQA-7357-B6-2", "ALGF-POLY-POLY-DIVL", "exact", "application", "algebraic division"],
  ["AQA-7357:1.3", "AQA-7357-B9", "ALGF-FUNC-TRAN-VERT", "exact", "application", "y = f(x) + a"],
  ["AQA-7357:1.3", "AQA-7357-B9", "ALGF-FUNC-TRAN-HORZ", "exact", "application", "y = f(x + a)"],
  ["AQA-7357:1.3", "AQA-7357-B9", "ALGF-FUNC-TRAN-STRE", "exact", "application", "y = af(x)"],
  ["AQA-7357:1.3", "AQA-7357-B11", "REAS-MODL-MODL-ASSM", "exact", "reasoning", "consideration of limitations"],
  ["AQA-7357:1.3", "AQA-7357-B11", "REAS-MODL-MODL-OUTP", "partial", "reasoning", "refinements of the models"],
  ["AQA-7357:1.3", "AQA-7357-B8", "ALGF-FUNC-COMP-INVG", "exact", "application", "inverse functions and their graphs"],
  ["AQA-7357:1.3", "AQA-7357-C1-1", "GEOM-COOR-LINE-GENR", "exact", "application", "ax + by + c = 0"],
  ["AQA-7357:1.3", "AQA-7357-C1-1", "GEOM-COOR-LINE-PARA", "exact", "application", "gradient conditions for two straight lines to be parallel"],
  ["AQA-7357:1.3", "AQA-7357-C1-1", "GEOM-COOR-LINE-PERP", "exact", "application", "or perpendicular"],
  ["AQA-7357:1.3", "AQA-7357-C2-1", "GEOM-COOR-CIRC-CENT", "exact", "application", "(x − a)² + (y − b)² = r²"],
  ["AQA-7357:1.3", "AQA-7357-C2-1", "GEOM-COOR-CIRC-EXPN", "exact", "application", "equation of a circle"],
  ["AQA-7357:1.3", "AQA-7357-C3", "GEOM-PARM-PARM-CART", "exact", "application", "conversion between Cartesian and parametric forms"],
  ["AQA-7357:1.3", "AQA-7357-C4", "GEOM-PARM-PARM-MODE", "exact", "application", "parametric equations in modelling"],
  ["AQA-7357:1.3", "AQA-7357-D1", "ALGF-SEQ-BINO-POSI", "exact", "application", "binomial expansion of a + bx for positive integer n"],
  ["AQA-7357:1.3", "AQA-7357-D1", "ALGF-SEQ-BINO-COEF", "exact", "application", "the notations n ! , nCr"],
  ["AQA-7357:1.3", "AQA-7357-D1", "ALGF-SEQ-BINO-RATN", "exact", "application", "Extend to any rational n"],
  ["AQA-7357:1.3", "AQA-7357-D4", "ALGF-SEQ-SEQU-NTH", "exact", "application", "the formulae for n th term"],
  ["AQA-7357:1.3", "AQA-7357-D4", "ALGF-SEQ-SERS-ARSM", "exact", "application", "the sum to n terms"],
  ["AQA-7357:1.3", "AQA-7357-D5", "ALGF-SEQ-SERS-GESM", "exact", "application", "the sum of a finite geometric series"],
  ["AQA-7357:1.3", "AQA-7357-D5", "ALGF-SEQ-SERS-INFI", "exact", "application", "the sum to infinity of a convergent geometric series"],
  ["AQA-7357:1.3", "AQA-7357-D5", "ALGF-SEQ-SERS-CONV", "exact", "reasoning", "including the use of r < 1"],
  ["AQA-7357:1.3", "AQA-7357-E7", "TRIG-IDEN-EQNS-INTR", "exact", "application", "in a given interval"],
  ["AQA-7357:1.3", "AQA-7357-E7", "TRIG-IDEN-EQNS-QUAD", "exact", "application", "quadratic equations in sin, cos and tan"],
  ["AQA-7357:1.3", "AQA-7357-E7", "TRIG-IDEN-EQNS-MULT", "exact", "application", "equations involving multiples of the unknown angle"],
  ["AQA-7357:1.3", "AQA-7357-E2", "TRIG-FUNC-V596C63600", "exact", "application", "standard small angle approximations"],
  ["AQA-7357:1.3", "AQA-7357-E3-1", "TRIG-FUNC-GRAP-SINE", "exact", "application", "sine, cosine and tangent functions; their graphs"],
  ["AQA-7357:1.3", "AQA-7357-E3-1", "TRIG-FUNC-GRAP-COSN", "exact", "application", "sine, cosine and tangent functions; their graphs"],
  ["AQA-7357:1.3", "AQA-7357-E3-1", "TRIG-FUNC-GRAP-TANG", "exact", "application", "sine, cosine and tangent functions; their graphs"],
  ["AQA-7357:1.3", "AQA-7357-E4", "TRIG-FUNC-ADVN-SECA", "exact", "knowledge", "definitions of secant, cosecant and cotangent"],
  ["AQA-7357:1.3", "AQA-7357-E4", "TRIG-FUNC-EXCT-INVS", "exact", "knowledge", "arcsin, arccos and arctan"],
  ["AQA-7357:1.3", "AQA-7357-E4", "TRIG-FUNC-EXCT-INVC", "exact", "knowledge", "arcsin, arccos and arctan"],
  ["AQA-7357:1.3", "AQA-7357-E4", "TRIG-FUNC-GRAP-V507F313F2", "exact", "application", "understanding of their graphs"],
  ["AQA-7357:1.3", "AQA-7357-E6-2", "TRIG-IDEN-IDEN-ADDR", "partial", "application", "R cos(θ ± α) or R sin(θ ± α)"],
  ["AQA-7357:1.3", "AQA-7357-E9", "TRIG-APPL-MODE-VECT", "exact", "application", "problems involving vectors"],
  ["AQA-7357:1.3", "AQA-7357-E9", "TRIG-APPL-MODE-KINE", "exact", "application", "kinematics"],
  ["AQA-7357:1.3", "AQA-7357-E9", "TRIG-APPL-MODE-MECH", "exact", "application", "forces"],
  ["AQA-7357:1.3", "AQA-7357-G1-2", "CALC-DIFF-APPL-V5E12F612D", "exact", "application", "convex and concave sections of curves"],
  ["AQA-7357:1.3", "AQA-7357-G3-1", "CALC-DIFF-APPL-INFL", "exact", "application", "points of inflection"],
  ["AQA-7357:1.3", "AQA-7357-G4", "CALC-DIFF-RULE-CHAI", "exact", "application", "the chain rule"],
  ["AQA-7357:1.3", "AQA-7357-G4", "CALC-DIFF-PARI-INVR", "exact", "application", "inverse functions"],
  ["AQA-7357:1.3", "AQA-7357-H3", "CALC-INTE-CONC-DEFI", "exact", "application", "Evaluate definite integrals"],
  ["AQA-7357:1.3", "AQA-7357-H3", "CALC-INTE-APPL-BETW", "exact", "application", "the area between two curves"],
  ["AQA-7357:1.3", "AQA-7357-G2-1", "CALC-DIFF-RULE-POWR", "exact", "application", "Differentiate x"],
  ["AQA-7357:1.3", "AQA-7357-G2-1", "CALC-DIFF-RULE-SUMD", "exact", "application", "constant multiples, sums and differences"],
  ["AQA-7357:1.3", "AQA-7357-G2-2", "CALC-DIFF-RULE-EXPL", "exact", "application", "Differentiate e and a"],
  ["AQA-7357:1.3", "AQA-7357-G2-2", "CALC-DIFF-RULE-TRIG", "exact", "application", "sin kx , cos kx , tan kx"],
  ["AQA-7357:1.3", "AQA-7357-G2-2", "CALC-DIFF-RULE-SUMD", "exact", "application", "sums, differences and constant multiples"],
  ["AQA-7357:1.3", "AQA-7357-H2-1", "CALC-INTE-RULE-POWR", "exact", "application", "Integrate x"],
  ["AQA-7357:1.3", "AQA-7357-H2-1", "CALC-INTE-RULE-V5A76A4288", "exact", "application", "sums, differences and constant multiples"],
  ["AQA-7357:1.3", "AQA-7357-H2-2", "CALC-INTE-RULE-TRIG", "exact", "application", "sin kx , cos kx"],
  ["AQA-7357:1.3", "AQA-7357-H2-2", "CALC-INTE-RULE-V5A76A4288", "exact", "application", "sums, differences and constant multiples"],
  ["AQA-7357:1.3", "AQA-7357-I3", "NUMM-NINT-TRAP-ESTM", "exact", "application", "use of the trapezium rule"],
  ["AQA-7357:1.3", "AQA-7357-I3", "NUMM-NINT-TRAP-OVER", "exact", "reasoning", "limits that it must lie between"],
  ["AQA-7357:1.3", "AQA-7357-I4", "REAS-PROB-PSOL-NUMM", "exact", "application", "numerical methods to solve problems in context"],
  ["AQA-7357:1.3", "AQA-7357-M2-1", "PROB-COMB-RULE-VENN", "exact", "application", "conditional probability, including the use of tree diagrams, Venn diagrams and two-way tables"],
  ["AQA-7357:1.3", "AQA-7357-J3", "VECT-BASIC-NOTN-ADDS", "exact", "application", "Add vectors diagrammatically"],
  ["AQA-7357:1.3", "AQA-7357-J3", "VECT-BASIC-NOTN-SCAL", "exact", "application", "multiplication by scalars"],
  ["AQA-7357:1.3", "AQA-7357-K1-3", "STAT-ENQ-SAMP-V533C8854F", "exact", "application", "opportunity sampling"],
  ["AQA-7357:1.3", "AQA-7357-M1-1", "PROB-COMB-RULE-MUTX", "exact", "application", "mutually exclusive"],
  ["AQA-7357:1.3", "AQA-7357-N1", "PROB-DRVD-DRVB-DIST", "exact", "application", "simple, discrete probability distributions"],
  ["AQA-7357:1.3", "AQA-7357-N1", "PROB-DIST-BINO-MODE", "exact", "application", "binomial distribution, as a model"],
  ["AQA-7357:1.3", "AQA-7357-N1", "PROB-DIST-BINO-PROB", "exact", "application", "calculate probabilities using the binomial distribution"],
  ["AQA-7357:1.3", "AQA-7357-N3", "PROB-DIST-BINO-MODE", "exact", "reasoning", "binomial or Normal model"],
  ["AQA-7357:1.3", "AQA-7357-N3", "REAS-MODL-MODL-ASSM", "exact", "reasoning", "may not be appropriate"],
  ["AQA-7357:1.3", "AQA-7357-O1", "STAT-TEST-HYPO-NULL", "exact", "application", "null hypothesis, alternative hypothesis"],
  ["AQA-7357:1.3", "AQA-7357-O1", "STAT-TEST-HYPO-V5D9C52441", "exact", "application", "test statistic"],
  ["AQA-7357:1.3", "AQA-7357-O1", "STAT-TEST-HYPO-TAIL", "exact", "application", "1-tail test, 2-tail test"],
  ["AQA-7357:1.3", "AQA-7357-O1", "STAT-TEST-HYPO-BINO", "exact", "application", "developed through a binomial model"],
  ["AQA-7357:1.3", "AQA-7357-O1", "STAT-TEST-HYPO-V5C70A5551", "exact", "application", "p -value"],
  ["AQA-7357:1.3", "AQA-7357-O1", "STAT-TEST-HYPO-V57C82D1FE", "exact", "application", "correlation coefficient using a given p -value or critical value"],
  ["AQA-7357:1.3", "AQA-7357-O3", "STAT-TEST-HYPO-MEAN", "exact", "application", "hypothesis test for the mean of a Normal distribution"],
  ["AQA-7357:1.3", "AQA-7357-P1-2", "MECH-FURT-SIUN", "exact", "knowledge", "derived quantities and units"],
  ["AQA-7357:1.3", "AQA-7357-Q1", "MECH-KIN-LINE-DIST", "exact", "knowledge", "displacement; distance travelled"],
  ["AQA-7357:1.3", "AQA-7357-Q1", "MECH-KIN-LINE-SPED", "exact", "knowledge", "velocity; speed"],
  ["AQA-7357:1.3", "AQA-7357-Q2", "MECH-KIN-LINE-AREA", "exact", "application", "area under the graph"],
  ["AQA-7357:1.3", "AQA-7357-Q3", "MECH-KIN-LINE-CONST", "exact", "application", "formulae for constant acceleration"],
  ["AQA-7357:1.3", "AQA-7357-Q5", "MECH-FURT-PROJ-MODEL", "exact", "application", "Model motion under gravity"],
  ["AQA-7357:1.3", "AQA-7357-Q5", "MECH-FURT-PROJ-HV", "partial", "application", "in a vertical plane using vectors"],
  ["AQA-7357:1.3", "AQA-7357-R2", "MECH-FORC-FORC-COMP", "exact", "application", "forces need to be resolved"],

  // AQA A-level Further Mathematics 7367.
  ["AQA-7367:1.1", "AQA-7367-A1", "REAS-PROF-PROF-V534EFC54E", "exact", "proof", "mathematical induction"],
  ["AQA-7367:1.1", "AQA-7367-A1", "CALC-SER-SUMS-SUMR", "partial", "proof", "sums of series"],
  ["AQA-7367:1.1", "AQA-7367-B6", "ALGF-CPLX-POLAR-MULT", "exact", "application", "Multiply and divide complex numbers in modulus-argument form"],
  ["AQA-7367:1.1", "AQA-7367-B8", "ALGF-CPLX-DEMO-MULTA", "exact", "application", "multiple angle formulae"],
  ["AQA-7367:1.1", "AQA-7367-B8", "ALGF-CPLX-DEMO-SERIES", "exact", "application", "sums of series"],
  ["AQA-7367:1.1", "AQA-7367-B10", "ALGF-CPLX-ROOT-NTH", "exact", "application", "n distinct nth roots"],
  ["AQA-7367:1.1", "AQA-7367-C3", "ALGF-MATR-TRAN-2D", "exact", "application", "linear transformations in 2D"],
  ["AQA-7367:1.1", "AQA-7367-C3", "ALGF-MATR-TRAN-3D", "exact", "application", "single transformations in 3D"],
  ["AQA-7367:1.1", "AQA-7367-C3", "ALGF-MATR-TRAN-COMP", "exact", "application", "successive transformations"],
  ["AQA-7367:1.1", "AQA-7367-C7", "ALGF-MATR-INV-INV", "exact", "application", "by use of the inverse matrix"],
  ["AQA-7367:1.1", "AQA-7367-D3", "CALC-SER-SUMS-SUMR", "exact", "application", "sums of integers, squares and cubes"],
  ["AQA-7367:1.1", "AQA-7367-D7", "CALC-DIFF-CONC-V594B8FC89", "exact", "application", "l'Hôpital's rule"],
  ["AQA-7367:1.1", "AQA-7367-D16-1", "ALGF-FUNC-TRAN-VERT", "partial", "application", "transformations of curves involving translations"],
  ["AQA-7367:1.1", "AQA-7367-D16-1", "ALGF-FUNC-TRAN-HORZ", "partial", "application", "transformations of curves involving translations"],
  ["AQA-7367:1.1", "AQA-7367-D16-1", "ALGF-FUNC-TRAN-STRE", "exact", "application", "stretches parallel to coordinate axes"],
  ["AQA-7367:1.1", "AQA-7367-E3", "CALC-FINT-APPL-MEAN", "exact", "application", "mean value of a function"],
  ["AQA-7367:1.1", "AQA-7367-E7", "CALC-FINT-APPL-ARCL", "exact", "application", "Arc length"],
  ["AQA-7367:1.1", "AQA-7367-E7", "CALC-FINT-APPL-SURF", "exact", "application", "area of surface of revolution"],
  ["AQA-7367:1.1", "AQA-7367-F6-3", "VECT-FURT-LINES-DIST", "exact", "application", "perpendicular distance between two lines, from a point to a line and from a point to a plane"],
  ["AQA-7367:1.1", "AQA-7367-H1-1", "CALC-HYP-HYP-GRAP", "exact", "application", "sketch their graphs"],
  ["AQA-7367:1.1", "AQA-7367-J2", "NUMM-ODE-EULR-EXPL", "exact", "application", "Euler’s step by step method"],
  ["AQA-7367:1.1", "AQA-7367-MD4", "VECT-FURT-V53B72894B", "exact", "application", "position, velocity and acceleration as vectors"],
  ["AQA-7367:1.1", "AQA-7367-MD3", "MECH-FURT-CIRC-RACC", "exact", "application", "a = rω² and a = v²/r"],
  ["AQA-7367:1.1", "AQA-7367-SA3", "PROB-DRVD-DRVB-EXPV", "exact", "application", "mean, variance, standard deviation, mode and median"],
  ["AQA-7367:1.1", "AQA-7367-SA3", "PROB-DRVD-DRVB-VARI", "exact", "application", "mean, variance, standard deviation, mode and median"],
  ["AQA-7367:1.1", "AQA-7367-SA3", "PROB-DRVD-DRVB-MODE", "exact", "application", "mean, variance, standard deviation, mode and median"],
  ["AQA-7367:1.1", "AQA-7367-SA3", "PROB-DRVD-DRVB-MEDI", "exact", "application", "mean, variance, standard deviation, mode and median"],
  ["AQA-7367:1.1", "AQA-7367-SA6-2", "PROB-DIST-DUNI-MODE", "exact", "reasoning", "this distribution can be used as a model"],
  ["AQA-7367:1.1", "AQA-7367-SB3-1", "PROB-DIST-POIS-MEAN", "exact", "knowledge", "mean, variance and standard deviation of a Poisson distribution"],
  ["AQA-7367:1.1", "AQA-7367-SB3-2", "PROB-DIST-POIS-MEAN", "exact", "application", "the mean and variance of X are equal"],
  ["AQA-7367:1.1", "AQA-7367-SB5", "STAT-TEST-HYPO-POIS", "exact", "application", "hypothesis test of a population mean from a single observation from a Poisson distribution"],
  ["AQA-7367:1.1", "AQA-7367-SD4-1", "PROB-DIST-CRV-MEAN", "exact", "application", "mean, variance and standard deviation"],
  ["AQA-7367:1.1", "AQA-7367-SD4-1", "PROB-DIST-CRV-V5CCD3FE59", "exact", "application", "mean, variance and standard deviation"],
  ["AQA-7367:1.1", "AQA-7367-SD7-3", "PROB-DIST-CUNI-MODE", "exact", "application", "rectangular distribution"],
  ["AQA-7367:1.1", "AQA-7367-SD7-4", "PROB-DIST-CRV-MEAN", "exact", "proof", "mean, variance and standard deviation"],
  ["AQA-7367:1.1", "AQA-7367-SD7-4", "PROB-DIST-CRV-V5CCD3FE59", "exact", "proof", "mean, variance and standard deviation"],
  ["AQA-7367:1.1", "AQA-7367-SE2", "STAT-INF2-CHISQ-INDEP", "exact", "application", "χ² statistic with appropriate degrees of freedom"],
  ["AQA-7367:1.1", "AQA-7367-SE4", "STAT-INF2-CHISQ-INDEP", "partial", "reasoning", "sources of association"],
  ["AQA-7367:1.1", "AQA-7367-SG1", "STAT-INF2-TDIST-TTEST", "exact", "application", "mean of a normal distribution with unknown variance using a t -statistic"],
  ["AQA-7367:1.1", "AQA-7367-SH1", "STAT-EST-ESTI-V516B7E1E1", "exact", "application", "mean of a normal distribution with known variance"],
  ["AQA-7367:1.1", "AQA-7367-SH2", "STAT-EST-ESTI-V59EB54818", "exact", "application", "large samples, for the mean of a normal distribution with unknown variance"],
  ["AQA-7367:1.1", "AQA-7367-SH4", "STAT-INF2-TDIST-TCI", "exact", "application", "small samples, for the mean of a normal distribution with unknown variance using the t -distribution"],
  ["AQA-7367:1.1", "AQA-7367-SF3", "PROB-DIST-EXPO-MEAN", "exact", "proof", "mean, variance and standard deviation for an exponential distribution"],
  ["AQA-7367:1.1", "AQA-7367-DE5", "DISC-PROJ-PROJ-GANT", "exact", "application", "Gantt (cascade) diagrams"],
  ["AQA-7367:1.1", "AQA-7367-DE5", "DISC-PROJ-PROJ-RESL", "partial", "application", "resource histograms"],
  ["AQA-7367:1.1", "AQA-7367-SF1-2", "PROB-DIST-CRV-CDF", "exact", "knowledge", "cumulative distribution function"],

  // AQA GCSE Mathematics 8300.
  ["AQA-8300:1.0", "AQA-8300-N2-1", "NUM-FRAC-PERC-V58658A972", "partial", "application", "profit, loss, cost price, selling price"],
  ["AQA-8300:1.0", "AQA-8300-N2-1", "NUM-OPS-CALC-NEG", "exact", "application", "all both positive and negative"],
  ["AQA-8300:1.0", "AQA-8300-N4", "NUM-SYS-TYPE-V58BC171E6", "exact", "application", "prime factorisation"],
  ["AQA-8300:1.0", "AQA-8300-N4", "NUM-SYS-TYPE-V5B20CA634", "exact", "application", "highest common factor, lowest common multiple"],
  ["AQA-8300:1.0", "AQA-8300-A10", "ALGF-FUNC-GRAP-INTR", "exact", "application", "intercepts of linear functions"],
  ["AQA-8300:1.0", "AQA-8300-A15", "MECH-KIN-LINE-V54E69BE35", "exact", "application", "distance-time graphs"],
  ["AQA-8300:1.0", "AQA-8300-R9-6", "NUM-FRAC-PERC-V5D5A83EE4", "exact", "application", "original value problems"],
  ["AQA-8300:1.0", "AQA-8300-R9-6", "NUM-FRAC-PERC-V545BCC9BB", "exact", "application", "simple interest"],
  ["AQA-8300:1.0", "AQA-8300-G1-1", "GEOM-SHAP-TERM-V58A928C3B", "partial", "knowledge", "points"],
  ["AQA-8300:1.0", "AQA-8300-G1-1", "GEOM-SHAP-TERM-V5B7688C92", "partial", "knowledge", "lines"],
  ["AQA-8300:1.0", "AQA-8300-G1-1", "GEOM-SHAP-TERM-V5C1785CC8", "partial", "knowledge", "planes"],
  ["AQA-8300:1.0", "AQA-8300-G1-1", "GEOM-SHAP-TERM-V559481376", "exact", "knowledge", "parallel lines"],
  ["AQA-8300:1.0", "AQA-8300-G1-1", "GEOM-SHAP-TERM-V52BA22A95", "exact", "knowledge", "perpendicular lines"],
  ["AQA-8300:1.0", "AQA-8300-G4", "GEOM-SHAP-ANGL-ISOS", "partial", "application", "properties of isosceles"],
  ["AQA-8300:1.0", "AQA-8300-G2-1", "GEOM-CONS-CONS-V5A323E847", "exact", "application", "constructing a perpendicular to a given line from/at a given point"],
  ["AQA-8300:1.0", "AQA-8300-G6", "GEOM-SHAP-SIMI-CRIT", "partial", "reasoning", "triangle congruence, similarity"],
  ["AQA-8300:1.0", "AQA-8300-P1", "PROB-BASIC-V535A32E23", "exact", "application", "frequency trees"],
  ["AQA-8300:1.0", "AQA-8300-S6-2", "STAT-BIVA-CORR-ZEROC", "exact", "knowledge", "no correlation"],

  // AQA Level 3 Mathematical Studies 8365.
  ["AQA-8365:1.4", "AQA-8365-2.7", "ALGF-SEQ-BINO-PASC", "exact", "application", "Pascal’s triangle"],
  ["AQA-8365:1.4", "AQA-8365-3.7", "GEOM-SHAP-CITH-SEMI", "exact", "application", "the angle in a semi-circle is 90°"],
  ["AQA-8365:1.4", "AQA-8365-3.7", "GEOM-SHAP-CITH-CHOR", "exact", "application", "the perpendicular from the centre to a chord bisects the chord"],
  ["AQA-8365:1.4", "AQA-8365-3.7", "GEOM-SHAP-CITH-TANG", "exact", "application", "the angle between tangent and radius is 90o"],
  ["AQA-8365:1.4", "AQA-8365-6.10", "TRIG-IDEN-EQNS-INTR", "exact", "application", "in given intervals"],
];

const removals = [
  ["AQA-7357:1.3", "AQA-7357-B9", "PROB-COMB-COUNT-COMB", "Function-graph transformations are unrelated to counting combinations."],
  ["AQA-7357:1.3", "AQA-7357-B11", "ALGF-LOG-EXPO-MODE", "The statement concerns generic function modelling, not specifically exponential models."],
  ["AQA-7357:1.3", "AQA-7357-E2", "TRIG-IDEN-IDEN-PYTH", "Small-angle approximations are not the Pythagorean trigonometric identity."],
  ["AQA-7357:1.3", "AQA-7357-G2-1", "CALC-INTE-RULE-EXPL", "The statement assesses differentiation of powers, not integration of exponentials."],
  ["AQA-7357:1.3", "AQA-7357-G2-2", "CALC-INTE-RULE-EXPL", "The statement assesses differentiation of exponentials and trigonometric functions, not integration."],
  ["AQA-7357:1.3", "AQA-7357-H2-1", "CALC-INTE-RULE-EXPL", "The statement assesses integration of powers, not integration of exponentials."],
  ["AQA-7357:1.3", "AQA-7357-I4", "NUM-RAT-RATI-PROP", "Contextual numerical methods are not a ratio-and-proportion concept."],
  ["AQA-7357:1.3", "AQA-7357-H5", "CALC-FINT-FINT-REDU", "The official statement explicitly excludes reduction formulae."],
  ["AQA-7357:1.3", "AQA-7357-M2-1", "NUM-SYS-SET-VENN", "The statement assesses Venn diagrams for conditional probability events, not Venn diagrams as an abstract set-theory topic."],
  ["AQA-7357:1.3", "AQA-7357-J3", "MECH-FORC-FORC-VECN", "The statement assesses general vector addition and scalar multiplication, not force-vector notation."],
  ["AQA-7357:1.3", "AQA-7357-N1", "STAT-SUMM-CENT-MEAN", "The statement explicitly excludes calculation of the mean and variance of discrete random variables."],
  ["AQA-7357:1.3", "AQA-7357-O3", "STAT-SUMM-CENT-MEAN", "The statement assesses a hypothesis test for a population mean, not calculation of a descriptive mean."],
  ["AQA-7357:1.3", "AQA-7357-P1-2", "MECH-KIN-LINE-ACCL", "The statement concerns derived quantities and their SI units rather than rectilinear acceleration as a motion concept."],
  ["AQA-7357:1.3", "AQA-7357-Q5", "MECH-DYN-NEWT-VERT", "The statement assesses projectile kinematics under gravity, not Newton-law dynamics in a vertical line."],
  ["AQA-7367:1.1", "AQA-7367-B6", "ALGF-CPLX-POLAR-CONV", "The statement assesses multiplication and division in modulus-argument form, not conversion between Cartesian and polar forms."],
  ["AQA-7367:1.1", "AQA-7367-C3", "GEOM-CONS-TRAN-COMB", "The official statement assesses matrix representations of linear transformations, not elementary geometric construction transformations."],
  ["AQA-7367:1.1", "AQA-7367-D3", "NUM-SYS-TYPE-INTG", "The statement assesses closed-form sums of powers, not the classification of integers."],
  ["AQA-7367:1.1", "AQA-7367-D16-1", "GEOM-CONS-TRAN-REFL", "The statement concerns transformations of function curves, not geometric reflection constructions."],
  ["AQA-7367:1.1", "AQA-7367-D16-1", "GEOM-CONS-TRAN-TRAN", "The statement concerns transformations of function curves, not geometric translation constructions."],
  ["AQA-7367:1.1", "AQA-7367-E3", "STAT-SUMM-CENT-MEAN", "The statement concerns the integral average value of a function, not a descriptive-statistics arithmetic mean."],
  ["AQA-7367:1.1", "AQA-7367-E7", "GEOM-MENS-CIRC-ARCL", "The statement concerns the calculus arc-length functional for general curves, not the length of a circular arc."],
  ["AQA-7367:1.1", "AQA-7367-F6-3", "GEOM-CONS-CONS-PDST", "The statement concerns vector distances among lines, points and planes in three dimensions, not only the elementary planar point-to-line construction."],
  ["AQA-7367:1.1", "AQA-7367-J2", "NUMM-ODE-EULR-IMPR", "The official statement specifies ordinary Euler's step-by-step method; the current node explicitly excludes ordinary Euler and represents improved Euler."],
  ["AQA-7367:1.1", "AQA-7367-MD4", "MECH-KIN-LINE-ACCL", "The statement assesses vector kinematics in circular motion, not scalar acceleration in rectilinear motion."],
  ["AQA-7367:1.1", "AQA-7367-MD3", "MECH-KIN-LINE-ACCL", "The acceleration formulae are radial acceleration in circular motion, not general rectilinear acceleration."],
  ["AQA-7367:1.1", "AQA-7367-SA3", "STAT-SUMM-CENT-STDV", "The statement assesses moments and location measures of a discrete random variable, not a descriptive-data standard deviation node."],
  ["AQA-7367:1.1", "AQA-7367-SA6-2", "PROB-DIST-NORM-MODE", "In context, “this distribution” refers to the discrete uniform distribution in the immediately preceding statement, not the Normal distribution."],
  ["AQA-7367:1.1", "AQA-7367-SB3-1", "STAT-SUMM-CENT-STDV", "The statement assesses the parameter-derived moments of the Poisson distribution, not generic descriptive standard deviation."],
  ["AQA-7367:1.1", "AQA-7367-SB3-2", "STAT-SUMM-CENT-MEAN", "The statement assesses the Poisson identity E(X)=Var(X)=λ, not generic descriptive mean."],
  ["AQA-7367:1.1", "AQA-7367-SD4-1", "STAT-SUMM-CENT-STDV", "The statement assesses moments derived from a continuous density, not generic descriptive standard deviation."],
  ["AQA-7367:1.1", "AQA-7367-SD7-4", "STAT-SUMM-CENT-STDV", "The statement assesses proofs of the continuous-uniform moments, not generic descriptive standard deviation."],
  ["AQA-7367:1.1", "AQA-7367-SE2", "STAT-INF2-TDIST-TWO", "A chi-squared association statistic is unrelated to a two-sample t procedure."],
  ["AQA-7367:1.1", "AQA-7367-SE4", "STAT-BIVA-CORR-INTR", "Interpreting cells that drive a chi-squared association is not interpretation of a correlation coefficient."],
  ["AQA-7367:1.1", "AQA-7367-SG1", "STAT-INF2-TDIST-TWO", "The official statement specifies a one-sample t test for a population mean, not a two-sample t procedure."],
  ["AQA-7367:1.1", "AQA-7367-SH1", "STAT-SUMM-CENT-MEAN", "The statement assesses a confidence interval for a population mean with known variance, not descriptive mean."],
  ["AQA-7367:1.1", "AQA-7367-SH2", "STAT-SUMM-CENT-MEAN", "The statement assesses a large-sample confidence interval for a population mean, not descriptive mean."],
  ["AQA-7367:1.1", "AQA-7367-SH4", "STAT-SUMM-CENT-MEAN", "The statement assesses a t confidence interval for a population mean, not descriptive mean."],
  ["AQA-7367:1.1", "AQA-7367-SF3", "STAT-SUMM-CENT-STDV", "The statement assesses distribution-specific exponential moments, not generic descriptive standard deviation."],
  ["AQA-7367:1.1", "AQA-7367-DE5", "STAT-DATA-REPR-HIST", "A resource histogram in project scheduling is not a statistical frequency histogram."],
  ["AQA-8300:1.0", "AQA-8300-A15", "MECH-KIN-LINE-STGR", "The official statement names distance-time graphs, while this node explicitly represents displacement-time graphs."],
  ["AQA-8300:1.0", "AQA-8300-P1", "PROB-COMB-RULE-TREE", "The official statement names frequency trees, while this node explicitly excludes frequency trees and represents probability trees."],
];

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempPath, filePath);
}

const ontology = JSON.parse(await readFile(path.join(activeRoot, "ontology.json"), "utf8"));
const knownNodeIds = new Set([
  ...ontology.nodes.map((node) => node.nodeId),
  ...ontologyAdditions.map((node) => node.nodeId),
]);
const mappingFiles = ["AQA-7357.json", "AQA-7367.json", "AQA-8300.json", "AQA-8365.json"];
const mappings = await Promise.all(
  mappingFiles.map(async (file) => JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8"))),
);
const statementByKey = new Map();
for (const mapping of mappings) {
  for (const statement of mapping.statements) {
    statementByKey.set(`${mapping.qualificationVersionId}|${statement.statementId}`, { mapping, statement });
  }
}

function evidenceSource(statement, needle) {
  const fields = [
    ["statementText", 0, statement.statementText],
    ...statement.notesText.map((text, index) => ["notesText", index, text]),
    ...statement.examplesText.map((text, index) => ["examplesText", index, text]),
  ];
  const found = fields.find(([, , text]) => text.includes(needle));
  if (!found) throw new Error(`${statement.statementId}: evidence not found: ${needle}`);
  return { evidenceField: found[0], evidenceIndex: found[1], evidenceSpan: needle };
}

const acceptedAdditions = additions.map(
  ([qualificationVersionId, statementId, nodeId, relation, assessmentDepth, evidenceNeedle]) => {
    const indexed = statementByKey.get(`${qualificationVersionId}|${statementId}`);
    if (!indexed) throw new Error(`Unknown statement ${qualificationVersionId}|${statementId}`);
    if (!knownNodeIds.has(nodeId)) throw new Error(`Unknown ontology node ${nodeId}`);
    if (indexed.statement.conceptLinks.some((link) => link.nodeId === nodeId)) {
      throw new Error(`${statementId}: ${nodeId} is already linked`);
    }
    return {
      qualificationVersionId,
      statementId,
      nodeId,
      relation,
      assessmentDepth,
      ...evidenceSource(indexed.statement, evidenceNeedle),
      reviewStatus: "codex-reviewed",
      reviewNotes: [
        "AQA source was reviewed locally; no official wording was sent to an external model.",
        "The cited source span explicitly assesses the canonical leaf concept.",
      ],
    };
  },
);

const acceptedRemovals = removals.map(([qualificationVersionId, statementId, nodeId, reason]) => {
  const indexed = statementByKey.get(`${qualificationVersionId}|${statementId}`);
  if (!indexed) throw new Error(`Unknown statement ${qualificationVersionId}|${statementId}`);
  if (!indexed.statement.conceptLinks.some((link) => link.nodeId === nodeId)) {
    throw new Error(`${statementId}: removal node ${nodeId} is not currently linked`);
  }
  return {
    qualificationVersionId,
    statementId,
    nodeId,
    reason,
    reviewStatus: "codex-reviewed",
  };
});
const correctedStatementKeys = new Set([
  ...acceptedAdditions.map((item) => `${item.qualificationVersionId}|${item.statementId}`),
  ...acceptedRemovals.map((item) => `${item.qualificationVersionId}|${item.statementId}`),
]);
const reviewedAssessableStatementCount = mappings.reduce(
  (total, mapping) => total + mapping.statements.filter((statement) => statement.statementType === "assessable-content").length,
  0,
);

const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  sourceBatch: JSON.parse(await readFile(path.join(activeRoot, "activation.json"), "utf8")).approvalBatch,
  reviewStatus: "codex-reviewed",
  provider: "local",
  requestedModel: "local",
  returnedModel: "local",
  externalSourceTransmissionCount: 0,
  scope: mappings.map((mapping) => ({
    qualificationVersionId: mapping.qualificationVersionId,
    assessableStatementCount: mapping.statements.filter((statement) => statement.statementType === "assessable-content").length,
  })),
  reviewedAssessableStatementCount,
  correctedStatementCount: correctedStatementKeys.size,
  unchangedReviewedStatementCount: reviewedAssessableStatementCount - correctedStatementKeys.size,
  additionCount: acceptedAdditions.length,
  removalCount: acceptedRemovals.length,
  ontologyAdditions,
  additions: acceptedAdditions,
  removals: acceptedRemovals,
  unresolved: [],
  methodology: [
    "All AQA statements remained local and were not sent to Kimi, DeepSeek, OpenAI, or another external model.",
    "The local review compared atomic statementText, notesText, and examplesText against comparison-eligible ontology leaves.",
    "Only corrections with an exact source substring and an explicit ontology scope match are proposed.",
  ],
};

await atomicWrite(outputPath, report);
console.log(JSON.stringify({
  reviewedAssessableStatementCount: report.reviewedAssessableStatementCount,
  additionCount: report.additionCount,
  removalCount: report.removalCount,
  outputPath,
}));
