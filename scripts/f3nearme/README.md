# F3 Near Me patches

Changes for [F3-Nation/f3nearme](https://github.com/F3-Nation/f3nearme) that
were written in a Claude Code session, which can read that repo but can't
push to the F3-Nation org. Each `.patch` is a `git format-patch` commit.

From a laptop that is signed in to GitHub:

```bash
scripts/f3nearme/apply.sh            # uses ~/f3nearme, clones it if needed
scripts/f3nearme/apply.sh ~/code/f3nearme
```

The script fast-forwards `main`, applies the patches with `git am --3way`,
and pushes. Afterwards delete the applied patches here and commit, so they
can't be applied twice.
