# Herocast

# ⚙️ Development

## install dependencies
```bash
yarn
```

## run as website
```bash
yarn start
```

## run as app
```bash
yarn dev
```

# 🚀 Release

How to make a release for mac:
```
export TAURI_PRIVATE_KEY=xyz
yarn rls:mac-intel && yarn rls:mac-apple
```
`
aws s3 cp ./src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/herocast_0.0.1_x64.dmg s3://herocast-releases/darwin/x86_64/v0.0.1/`

` aws s3 cp ./src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/herocast_0.0.1_aarch64.dmg aws s3 cp s3://herocast-releases/darwin/aarch64/v0.0.1/`


Then copy the two .dmg files to S3

# 📦 TODO
soon: create release via github actions

# Resources
- originally based on https://github.com/michyaraque/tauri-boilerplate
- for autocomplete in new posts:  https://github.com/webscopeio/react-textarea-autocomplete
- ...

`
console.log('VITE_VERCEL_ENV', import.meta.env.VITE_VERCEL_ENV);
`
