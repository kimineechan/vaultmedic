# Publish VaultMedic on GitHub

This repository is ready to publish under the MIT license. It includes automated tests, CodeQL scanning, dependency updates, Windows packaging, release checksums, a security policy, and contribution guidance.

## First upload

Create an empty public repository named `vaultmedic` on GitHub. Do not add a README or license on the GitHub form because both are already included here.

Open a terminal inside this folder and run:

```bash
git init
git add .
git commit -m "Initial open source release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vaultmedic.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Build the Windows executables

The repository includes a Windows release workflow. You can run it from the Actions tab with the Run workflow button. The completed workflow provides an installer, a portable executable, and SHA256 checksums as downloadable artifacts.

To create a public GitHub Release automatically, publish a version tag:

```bash
git tag v0.1.4
git push origin v0.1.4
```

The tag starts the same verified Windows build and attaches its executable files to a new GitHub Release.

You can also build on a Windows computer:

```bash
npm ci
npm run package:win
```

The results appear in the `release` folder. The release workflow also creates an unpacked Windows ZIP. This fallback bypasses the portable wrapper: extract the ZIP, keep every file together, and open `VaultMedic.exe`.

## Important release notes

The generated executables are unsigned unless you configure a trusted code signing certificate. Windows SmartScreen can show an unknown publisher warning for unsigned community builds. Never place a certificate file or password in the repository. Store signing credentials as encrypted GitHub secrets when you are ready to sign releases.

Never commit a real browser password export. CSV files, environment files, private keys, build results, and dependencies are excluded by `.gitignore`.
