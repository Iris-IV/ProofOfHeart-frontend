/**
 * Commitlint configuration for ProofOfHeart Frontend
 * Enforces Conventional Commits format with custom rules
 *
 * Format: <type>(<scope>): <subject>
 * Example: feat(auth): add email verification
 */

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // A new feature
        "fix", // A bug fix
        "docs", // Documentation only changes
        "style", // Changes that do not affect the meaning of the code (formatting, missing semicolons, etc)
        "refactor", // A code change that neither fixes a bug nor adds a feature
        "perf", // A code change that improves performance
        "test", // Adding missing tests or correcting existing tests
        "chore", // Changes to build process, dependencies, or tooling
        "ci", // Changes to CI/CD configuration files and scripts
        "revert", // Reverts a previous commit
      ],
    ],
    "type-case": [2, "always", "lowercase"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "lowercase"],
    "scope-empty": [0], // Scope is optional
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
  prompt: {
    settings: {},
    messages: {
      skip: ":skip",
      max: "upper %s",
      min: "lower %s",
      emptyNotAllowed: "empty not allowed",
      upperLimitExceeded: "upper limit exceeded by %s characters",
      commitIsNotInScope: 'commit "%s" is not in scope of allowed commits',
    },
    questions: {
      type: {
        description: "Select the type of change that you're committing:",
        enum: {
          feat: {
            description: "A new feature",
            title: "Features",
            emoji: "✨",
          },
          fix: {
            description: "A bug fix",
            title: "Bug Fixes",
            emoji: "🐛",
          },
          docs: {
            description: "Documentation only changes",
            title: "Documentation",
            emoji: "📚",
          },
          style: {
            description:
              "Changes that do not affect the meaning of the code (formatting, missing semicolons, etc)",
            title: "Styles",
            emoji: "💎",
          },
          refactor: {
            description: "A code change that neither fixes a bug nor adds a feature",
            title: "Code Refactoring",
            emoji: "📦",
          },
          perf: {
            description: "A code change that improves performance",
            title: "Performance Improvements",
            emoji: "🚀",
          },
          test: {
            description: "Adding missing tests or correcting existing tests",
            title: "Tests",
            emoji: "🧪",
          },
          chore: {
            description: "Changes to build process, dependencies, or tooling",
            title: "Chores",
            emoji: "🔧",
          },
          ci: {
            description: "Changes to CI/CD configuration files and scripts",
            title: "CI/CD",
            emoji: "⚙️",
          },
          revert: {
            description: "Reverts a previous commit",
            title: "Reverts",
            emoji: "⏮️",
          },
        },
      },
      scope: {
        description: "What is the scope of this change (optional)?",
      },
      subject: {
        description: "Write a short, imperative tense description of the change:",
      },
      body: {
        description:
          'Provide a longer description of the changes (optional). Use "|" to break new line:',
      },
      isBreaking: {
        description: "Are there any breaking changes?",
      },
      breakingBody: {
        description:
          "A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself:",
      },
      breaking: {
        description: "Describe the breaking changes:",
      },
      isIssueAffected: {
        description: "Does this change affect any open issues?",
      },
      issuesBody: {
        description:
          "If issues are closed, the commit requires a body. Please enter a longer description of the commit itself:",
      },
      issues: {
        description: 'Add issue references (e.g. "fixes #123", "refs #456"):',
      },
    },
  },
};
