#!/bin/bash

echo "📦 SangoCast Deployment"

echo "Etat du projet:"
git status

echo ""
read -p "Message du commit: " msg

git add .
git commit -m "$msg"
git push origin master

echo ""
echo "Push vers GitHub terminé"
echo "Vercel va redeployer automatiquement"