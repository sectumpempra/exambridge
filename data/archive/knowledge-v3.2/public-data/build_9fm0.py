import json
import os

syllabus = {
    "board": "Edexcel",
    "subjectCode": "9FM0",
    "subjectName": "A-Level Further Mathematics",
    "level": "A-Level",
    "version": "3.2",
    "papers": ["CorePure1", "CorePure2", "FP1", "FP2", "FS1", "FS2", "FM1", "FM2", "D1", "D2"],
    "totalTopics": 35,
    "topics": [
        {
            "topicId": "1",
            "topicName": "Proof",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "1.1",
                    "subtopicName": "Construct proofs using mathematical induction",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "2",
            "topicName": "Complex numbers",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "2.1",
                    "subtopicName": "Solve any quadratic equation with real coefficients; solve cubic or quartic equations with real coefficients",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.2",
                    "subtopicName": "Add, subtract, multiply and divide complex numbers in the form x + iy",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.3",
                    "subtopicName": "Understand and use the complex conjugate; know that non-real roots occur in conjugate pairs",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.4",
                    "subtopicName": "Use and interpret Argand diagrams",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.5",
                    "subtopicName": "Convert between the Cartesian form and the modulus-argument form of a complex number",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.6",
                    "subtopicName": "Multiply and divide complex numbers in modulus-argument form",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.7",
                    "subtopicName": "Construct and interpret simple loci in the Argand diagram",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.8",
                    "subtopicName": "Understand de Moivre's theorem and use it to find multiple angle formulae and sums of series",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.9",
                    "subtopicName": "Know and use the definition eiθ = cos θ + i sin θ and the form z = reiθ",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.10",
                    "subtopicName": "Find the n distinct nth roots of reiθ and know they form a regular n-gon",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "2.11",
                    "subtopicName": "Use complex roots of unity to solve geometric problems",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "3",
            "topicName": "Matrices",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "3.1",
                    "subtopicName": "Add, subtract and multiply conformable matrices; multiply a matrix by a scalar",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.2",
                    "subtopicName": "Understand and use zero and identity matrices",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.3",
                    "subtopicName": "Use matrices to represent linear transformations in 2-D and single transformations in 3-D",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.4",
                    "subtopicName": "Find invariant points and lines for a linear transformation",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.5",
                    "subtopicName": "Calculate determinants of 2×2 and 3×3 matrices and interpret as scale factors",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.6",
                    "subtopicName": "Understand and use singular and non-singular matrices; calculate and use the inverse",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.7",
                    "subtopicName": "Solve three linear simultaneous equations in three variables by use of the inverse matrix",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "3.8",
                    "subtopicName": "Interpret geometrically the solution and failure of solution of three simultaneous linear equations",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "4",
            "topicName": "Further algebra and functions",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "4.1",
                    "subtopicName": "Understand and use the relationship between roots and coefficients of polynomial equations up to quartic",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "4.2",
                    "subtopicName": "Form a polynomial equation whose roots are a linear transformation of the roots of a given equation",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "4.3",
                    "subtopicName": "Understand and use formulae for the sums of integers, squares and cubes",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "4.4",
                    "subtopicName": "Understand and use the method of differences for summation of series including partial fractions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "4.5",
                    "subtopicName": "Find the Maclaurin series of a function including the general term",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "4.6",
                    "subtopicName": "Recognise and use the Maclaurin series for e^x, ln(1+x), sin x, cos x and (1+x)^n",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "5",
            "topicName": "Further calculus",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "5.1",
                    "subtopicName": "Derive formulae for and calculate volumes of revolution",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "5.2",
                    "subtopicName": "Evaluate improper integrals",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "5.3",
                    "subtopicName": "Understand and evaluate the mean value of a function",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "5.4",
                    "subtopicName": "Integrate using partial fractions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "5.5",
                    "subtopicName": "Differentiate inverse trigonometric functions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "5.6",
                    "subtopicName": "Integrate functions of the form (a^2 - x^2)^(-1/2) and (a^2 - x^2)^(-1)",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "6",
            "topicName": "Further vectors",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "6.1",
                    "subtopicName": "Understand and use the vector and Cartesian forms of an equation of a straight line in 3-D",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "6.2",
                    "subtopicName": "Understand and use the vector and Cartesian forms of the equation of a plane",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "6.3",
                    "subtopicName": "Calculate the scalar product and use it to express the equation of a plane and calculate angles",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "6.4",
                    "subtopicName": "Check whether vectors are perpendicular by using the scalar product",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "6.5",
                    "subtopicName": "Find the intersection of a line and a plane; calculate the perpendicular distance",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "7",
            "topicName": "Polar coordinates",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "7.1",
                    "subtopicName": "Understand and use polar coordinates and convert between polar and Cartesian coordinates",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "7.2",
                    "subtopicName": "Sketch curves with r given as a function of θ, including use of trigonometric functions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "7.3",
                    "subtopicName": "Find the area enclosed by a polar curve",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "8",
            "topicName": "Hyperbolic functions",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "8.1",
                    "subtopicName": "Understand the definitions of sinh x, cosh x and tanh x, including domains and ranges",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "8.2",
                    "subtopicName": "Differentiate and integrate hyperbolic functions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "8.3",
                    "subtopicName": "Understand and use the definitions of the inverse hyperbolic functions and their domains and ranges",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "8.4",
                    "subtopicName": "Derive and use the logarithmic forms of the inverse hyperbolic functions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "8.5",
                    "subtopicName": "Integrate functions of the form (x^2+a^2)^(-1/2) and (x^2-a^2)^(-1/2)",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "9",
            "topicName": "Differential equations",
            "papers": ["CorePure1", "CorePure2"],
            "subtopics": [
                {
                    "subtopicId": "9.1",
                    "subtopicName": "Find and use an integrating factor to solve differential equations of form dy/dx + P(x)y = Q(x)",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.2",
                    "subtopicName": "Find both general and particular solutions to differential equations",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.3",
                    "subtopicName": "Use differential equations in modelling in kinematics and other contexts",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.4",
                    "subtopicName": "Solve differential equations of form y'' + ay' + by = 0 using the auxiliary equation",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.5",
                    "subtopicName": "Solve differential equations of form y'' + ay' + by = f(x) where f is polynomial, exponential or trigonometric",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.6",
                    "subtopicName": "Understand and use the relationship between discriminant cases and the form of solution",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.7",
                    "subtopicName": "Solve the equation for simple harmonic motion and relate the solution to the motion",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.8",
                    "subtopicName": "Model damped oscillations using second order differential equations and interpret their solutions",
                    "papers": ["CorePure1", "CorePure2"]
                },
                {
                    "subtopicId": "9.9",
                    "subtopicName": "Analyse and interpret models with coupled first order simultaneous equations",
                    "papers": ["CorePure1", "CorePure2"]
                }
            ]
        },
        {
            "topicId": "10",
            "topicName": "Further Trigonometry",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "10.1",
                    "subtopicName": "The t-formulae",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "10.2",
                    "subtopicName": "Applications of t-formulae to trigonometric identities",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "10.3",
                    "subtopicName": "Applications of t-formulae to solve trigonometric equations",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "11",
            "topicName": "Further calculus",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "11.1",
                    "subtopicName": "Derivation and use of Taylor series",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "11.2",
                    "subtopicName": "Use of series expansions to find limits",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "11.3",
                    "subtopicName": "Leibnitz's theorem",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "11.4",
                    "subtopicName": "L'Hospital's Rule",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "11.5",
                    "subtopicName": "The Weierstrass substitution for integration",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "12",
            "topicName": "Further differential equations",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "12.1",
                    "subtopicName": "Use of Taylor series method for series solution of differential equations",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "12.2",
                    "subtopicName": "Differential equations reducible by means of a given substitution",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "13",
            "topicName": "Coordinate systems",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "13.1",
                    "subtopicName": "Cartesian and parametric equations for the parabola, ellipse, rectangular hyperbola and hyperbola",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "13.2",
                    "subtopicName": "The focus-directrix properties of the parabola, ellipse and hyperbola, including eccentricity",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "13.3",
                    "subtopicName": "Tangents and normals to these curves",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "13.4",
                    "subtopicName": "Loci problems",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "14",
            "topicName": "Further vectors",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "14.1",
                    "subtopicName": "The vector product of two vectors",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "14.2",
                    "subtopicName": "The scalar triple product",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "14.3",
                    "subtopicName": "Applications of vectors to three dimensional geometry involving points, lines and planes",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "15",
            "topicName": "Further numerical methods",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "15.1",
                    "subtopicName": "Numerical solution of first order and second order differential equations",
                    "papers": ["FP1"]
                },
                {
                    "subtopicId": "15.2",
                    "subtopicName": "Simpson's rule",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "16",
            "topicName": "Inequalities",
            "papers": ["FP1"],
            "subtopics": [
                {
                    "subtopicId": "16.1",
                    "subtopicName": "The manipulation and solution of algebraic inequalities and inequations, including modulus sign",
                    "papers": ["FP1"]
                }
            ]
        },
        {
            "topicId": "17",
            "topicName": "Groups",
            "papers": ["FP2"],
            "subtopics": [
                {
                    "subtopicId": "17.1",
                    "subtopicName": "The Axioms of a group",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "17.2",
                    "subtopicName": "Examples of groups and Cayley tables; cyclic groups and permutation groups",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "17.3",
                    "subtopicName": "The order of a group and the order of an element; subgroups",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "17.4",
                    "subtopicName": "Lagrange's theorem",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "17.5",
                    "subtopicName": "Isomorphism",
                    "papers": ["FP2"]
                }
            ]
        },
        {
            "topicId": "18",
            "topicName": "Further calculus",
            "papers": ["FP2"],
            "subtopics": [
                {
                    "subtopicId": "18.1",
                    "subtopicName": "Further Integration — Reduction formulae",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "18.2",
                    "subtopicName": "The calculation of arc length and the area of a surface of revolution",
                    "papers": ["FP2"]
                }
            ]
        },
        {
            "topicId": "19",
            "topicName": "Further matrix algebra",
            "papers": ["FP2"],
            "subtopics": [
                {
                    "subtopicId": "19.1",
                    "subtopicName": "Eigenvalues and eigenvectors of 2×2 and 3×3 matrices",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "19.2",
                    "subtopicName": "Reduction of matrices to diagonal form; symmetric matrices and orthogonal diagonalisation",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "19.3",
                    "subtopicName": "The use of the Cayley-Hamilton theorem",
                    "papers": ["FP2"]
                }
            ]
        },
        {
            "topicId": "20",
            "topicName": "Further complex numbers",
            "papers": ["FP2"],
            "subtopics": [
                {
                    "subtopicId": "20.1",
                    "subtopicName": "Further loci and regions in the Argand diagram",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "20.2",
                    "subtopicName": "Elementary transformations from the z-plane to the w-plane",
                    "papers": ["FP2"]
                }
            ]
        },
        {
            "topicId": "21",
            "topicName": "Number theory",
            "papers": ["FP2"],
            "subtopics": [
                {
                    "subtopicId": "21.1",
                    "subtopicName": "The division theorem and its application to the Euclidean Algorithm and congruences",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "21.2",
                    "subtopicName": "Bezout's identity",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "21.3",
                    "subtopicName": "Modular arithmetic and properties of congruences",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "21.4",
                    "subtopicName": "Fermat's Little Theorem",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "21.5",
                    "subtopicName": "Divisibility Tests",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "21.6",
                    "subtopicName": "Solution of congruence equations",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "21.7",
                    "subtopicName": "Combinatorics: counting problems, permutations and combinations",
                    "papers": ["FP2"]
                }
            ]
        },
        {
            "topicId": "22",
            "topicName": "Further sequences and series",
            "papers": ["FP2"],
            "subtopics": [
                {
                    "subtopicId": "22.1",
                    "subtopicName": "First and second order recurrence relations",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "22.2",
                    "subtopicName": "The solution of recurrence relations to obtain closed forms",
                    "papers": ["FP2"]
                },
                {
                    "subtopicId": "22.3",
                    "subtopicName": "Proof by induction of closed forms",
                    "papers": ["FP2"]
                }
            ]
        },
        {
            "topicId": "23",
            "topicName": "Discrete and probability distributions",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "23.1",
                    "subtopicName": "Calculation of the mean and variance of discrete probability distributions; E(g(X))",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "24",
            "topicName": "Poisson & binomial distributions",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "24.1",
                    "subtopicName": "The Poisson distribution",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "24.2",
                    "subtopicName": "The mean and variance of the binomial and Poisson distributions",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "24.3",
                    "subtopicName": "The use of the Poisson distribution as an approximation to the binomial distribution",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "25",
            "topicName": "Geometric and negative binomial distributions",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "25.1",
                    "subtopicName": "Geometric and negative binomial distributions",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "25.2",
                    "subtopicName": "Mean and variance of a geometric distribution",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "25.3",
                    "subtopicName": "Mean and variance of negative binomial distribution",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "26",
            "topicName": "Hypothesis Testing",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "26.1",
                    "subtopicName": "Extend ideas of hypothesis tests to test for the mean of a Poisson distribution",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "26.2",
                    "subtopicName": "Extend hypothesis testing to test for the parameter p of a geometric distribution",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "27",
            "topicName": "Central Limit Theorem",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "27.1",
                    "subtopicName": "Applications of the Central Limit Theorem to other distributions",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "28",
            "topicName": "Chi Squared Tests",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "28.1",
                    "subtopicName": "Goodness of fit tests and Contingency Tables",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "29",
            "topicName": "Probability generating functions",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "29.1",
                    "subtopicName": "Definitions, derivations and applications of probability generating functions",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "29.2",
                    "subtopicName": "Use probability generating functions to find the mean and variance",
                    "papers": ["FS1"]
                },
                {
                    "subtopicId": "29.3",
                    "subtopicName": "Probability generating function of the sum of independent random variables",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "30",
            "topicName": "Quality of tests",
            "papers": ["FS1"],
            "subtopics": [
                {
                    "subtopicId": "30.1",
                    "subtopicName": "Type I and Type II errors; size and power of a test; the power function",
                    "papers": ["FS1"]
                }
            ]
        },
        {
            "topicId": "31",
            "topicName": "Linear Regression",
            "papers": ["FS2"],
            "subtopics": [
                {
                    "subtopicId": "31.1",
                    "subtopicName": "Least squares linear regression; concept of residuals and minimising sum of squares of residuals",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "31.2",
                    "subtopicName": "Residuals; residual sum of squares (RSS)",
                    "papers": ["FS2"]
                }
            ]
        },
        {
            "topicId": "32",
            "topicName": "Continuous probability distributions",
            "papers": ["FS2"],
            "subtopics": [
                {
                    "subtopicId": "32.1",
                    "subtopicName": "The concept of a continuous random variable; probability density function and cumulative distribution function",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "32.2",
                    "subtopicName": "Relationship between probability density and cumulative distribution functions",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "32.3",
                    "subtopicName": "Mean and variance of continuous random variables; E(g(X)); mode, median, percentiles; skewness",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "32.4",
                    "subtopicName": "The continuous uniform (rectangular) distribution",
                    "papers": ["FS2"]
                }
            ]
        },
        {
            "topicId": "33",
            "topicName": "Correlation",
            "papers": ["FS2"],
            "subtopics": [
                {
                    "subtopicId": "33.1",
                    "subtopicName": "Use of formulae to calculate the product moment correlation coefficient",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "33.2",
                    "subtopicName": "Spearman's rank correlation coefficient",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "33.3",
                    "subtopicName": "Testing the hypothesis that a correlation is zero using Spearman's rank or product moment correlation",
                    "papers": ["FS2"]
                }
            ]
        },
        {
            "topicId": "34",
            "topicName": "Combinations of random variables",
            "papers": ["FS2"],
            "subtopics": [
                {
                    "subtopicId": "34.1",
                    "subtopicName": "Distribution of linear combinations of independent Normal random variables",
                    "papers": ["FS2"]
                }
            ]
        },
        {
            "topicId": "35",
            "topicName": "Estimation, confidence intervals and tests using a normal distribution",
            "papers": ["FS2"],
            "subtopics": [
                {
                    "subtopicId": "35.1",
                    "subtopicName": "Concepts of standard error, estimator, bias; quality of estimators",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "35.2",
                    "subtopicName": "Concept of a confidence interval and its interpretation",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "35.3",
                    "subtopicName": "Confidence limits for a Normal mean, with variance known",
                    "papers": ["FS2"]
                },
                {
                    "subtopicId": "35.4",
                    "subtopicName": "Hypothesis test for the difference between the means of two Normal distributions with variances known",
                    "papers": ["FS2"]
                }
            ]
        }
    ]
}

# Verify total topics
assert len(syllabus["topics"]) == syllabus["totalTopics"], \
    f"totalTopics mismatch: {syllabus['totalTopics']} vs {len(syllabus['topics'])}"

# Count subtopics
total_subtopics = sum(len(t["subtopics"]) for t in syllabus["topics"])
print(f"Total topics: {syllabus['totalTopics']}")
print(f"Total subtopics: {total_subtopics}")

output_path = "/Users/yuzhou/WorkBuddy/2026-07-06-14-39-16/syllabi/syllabus-v3.2-Edexcel-9FM0.json"
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(syllabus, f, indent=2, ensure_ascii=False)

print(f"Written to {output_path}")
