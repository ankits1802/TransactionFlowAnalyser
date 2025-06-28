# 🔄 TransactionFlowAnalyser

A comprehensive database transaction analysis tool that validates transaction schedules, generates conflict graphs, performs recoverability checks, and detects deadlocks for effective concurrency control in database systems.

## 📋 Table of Contents

* [Overview](#overview)
* [Features](#features)
* [Installation](#installation)
* [Usage](#usage)
* [Core Components](#core-components)
* [Mathematical Foundations](#mathematical-foundations)
* [Examples](#examples)
* [Contributing](#contributing)
* [License](#license)

## 🎯 Overview

The **TransactionFlowAnalyser** is a sophisticated tool designed to analyze and validate database transaction schedules. It provides essential functionality for database administrators, developers, and researchers working with concurrent database systems. The tool ensures data consistency and helps prevent common concurrency issues through comprehensive analysis of transaction flows.

## ✨ Features

| Feature                          | Description                                             | Status   |
| -------------------------------- | ------------------------------------------------------- | -------- |
| 🔍 **Conflict Graph Generation** | Creates visual representations of transaction conflicts | ✅ Active |
| 🔄 **Recoverability Analysis**   | Validates transaction recovery mechanisms               | ✅ Active |
| ⚠️ **Deadlock Detection**        | Identifies potential deadlock scenarios                 | ✅ Active |
| 📊 **Schedule Validation**       | Ensures transaction schedules meet ACID properties      | ✅ Active |
| 🎨 **Visual Analytics**          | Provides graphical insights into transaction flows      | ✅ Active |

## 🚀 Installation

### Prerequisites

* Python 3.8 or higher
* pip package manager
* Git

### Setup Instructions

```bash
# Clone the repository
git clone https://github.com/ankits1802/TransactionFlowAnalyser.git

# Navigate to project directory
cd TransactionFlowAnalyser

# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py
```

## 💻 Usage

### **Basic Transaction Analysis**

```python
from transaction_analyzer import TransactionAnalyzer

# Initialize analyzer
analyzer = TransactionAnalyzer()

# Load transaction schedule
schedule = analyzer.load_schedule("sample_transactions.txt")

# Generate conflict graph
conflict_graph = analyzer.generate_conflict_graph(schedule)

# Check recoverability
is_recoverable = analyzer.check_recoverability(schedule)

# Detect deadlocks
deadlocks = analyzer.detect_deadlocks(schedule)
```

### **Advanced Configuration**

```python
# Configure analysis parameters
config = {
    'strict_2pl': True,
    'timestamp_ordering': False,
    'multiversion_control': True
}

analyzer = TransactionAnalyzer(config)
```

## 🔧 Core Components

### **Transaction Schedule Parser**

Parses transaction schedules from various formats including:

* Text files with transaction operations
* CSV format with structured data
* JSON format for complex schedules

### **Conflict Graph Generator**

Creates directed graphs representing conflicts between transactions:

* **Read-Write conflicts**: When one transaction reads data that another writes
* **Write-Read conflicts**: When one transaction writes data that another reads
* **Write-Write conflicts**: When multiple transactions write to the same data

### **Recoverability Checker**

Validates different levels of recoverability:

* **Recoverable schedules**: Committed transactions read only committed data
* **Cascadeless schedules**: No cascading rollbacks required
* **Strict schedules**: No reading or writing uncommitted data

### **Deadlock Detector**

Implements multiple deadlock detection algorithms:

* Wait-for graph analysis
* Timeout-based detection
* Cycle detection in resource allocation graphs

## 📐 Mathematical Foundations

### **Conflict Serializability**

A schedule $S$ is conflict serializable if it is conflict equivalent to some serial schedule. Two schedules are conflict equivalent if:

$$
\forall \text{ conflicting operations } (O_i, O_j): O_i \prec_S O_j \iff O_i \prec_{S'} O_j
$$

Where $O_i \prec_S O_j$ means operation $O_i$ precedes $O_j$ in schedule $S$.

### **Precedence Graph**

For a schedule $S$ with transactions $T_1, T_2, ..., T_n$, the precedence graph $G(S)$ is defined as:

$$
G(S) = (V, E)
$$

Where:

* $V = \{T_1, T_2, ..., T_n\}$ (set of transactions)
* $E = \{(T_i, T_j) | T_i \text{ and } T_j \text{ have conflicting operations and } T_i \text{ precedes } T_j\}$

### **Deadlock Detection Formula**

A deadlock exists if there's a cycle in the wait-for graph. For transactions $T_i$ waiting for $T_j$:

$$
\text{Deadlock} = \exists \text{ cycle } C \text{ in } WFG \text{ where } |C| \geq 2
$$

### **Recoverability Conditions**

A schedule $S$ is recoverable if:

$$
\forall T_i, T_j: \text{if } T_j \text{ reads from } T_i \text{ then } C_i < C_j \text{ or } A_i < A_j
$$

Where $C_i$ and $A_i$ represent commit and abort times respectively.

## 📊 Examples

### **Example 1: Simple Conflict Detection**

```python
# Transaction schedule: T1: R(A), W(A); T2: R(A), W(B)
schedule = [
    ('T1', 'R', 'A'),
    ('T2', 'R', 'A'), 
    ('T1', 'W', 'A'),
    ('T2', 'W', 'B')
]

conflicts = analyzer.find_conflicts(schedule)
print(f"Detected conflicts: {conflicts}")
# Output: [('T1', 'T2', 'A', 'RW')]
```

### **Example 2: Deadlock Scenario**

| Transaction | Operation Sequence | Status          |
| ----------- | ------------------ | --------------- |
| T1          | Lock(A) → Wait(B)  | 🔒 Waiting      |
| T2          | Lock(B) → Wait(A)  | 🔒 Waiting      |
| **Result**  | **Circular Wait**  | ⚠️ **Deadlock** |

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Development Guidelines**

* Follow PEP 8 style guidelines
* Write comprehensive tests
* Update documentation for new features
* Ensure backward compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

* Database Systems research community
* Contributors to concurrency control algorithms
* Open source testing frameworks

## 📞 Support

For questions, issues, or feature requests:

* 📧 **Email**: Create an issue on GitHub
* 🐛 **Bug Reports**: Use the issue tracker
* 💡 **Feature Requests**: Submit via GitHub issues
* 📚 **Documentation**: Check the wiki section

**Built with ❤️ for the database community**
