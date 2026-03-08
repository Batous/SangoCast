#!/bin/bash
echo "🧹 Nettoyage du repo"

git gc
git prune

echo "✅ Nettoyage terminé"