import tarfile, os

# aicrm standalone is nested due to monorepo structure
base = 'apps/aicrm'
standalone_root = os.path.join(base, '.next/standalone/workspace/realestatecrm/apps/aicrm')
if not os.path.isdir(standalone_root):
    standalone_root = os.path.join(base, '.next/standalone')

tf = tarfile.open('deploy-aicrm.tar.gz', 'w:gz')
count = 0

for item in ['server.js', 'package.json']:
    p = os.path.join(standalone_root, item)
    if os.path.isfile(p):
        tf.add(p, arcname=item)
        count += 1

next_dir = os.path.join(standalone_root, '.next')
if os.path.isdir(next_dir):
    for root, dirs, files in os.walk(next_dir):
        dirs[:] = [d for d in dirs if d not in ('cache',)]
        for f in files:
            full = os.path.join(root, f)
            tf.add(full, arcname=os.path.join('.next', os.path.relpath(full, next_dir)))
            count += 1

nm_dir = os.path.join(standalone_root, 'node_modules')
if os.path.isdir(nm_dir):
    for root, dirs, files in os.walk(nm_dir):
        for f in files:
            full = os.path.join(root, f)
            tf.add(full, arcname=os.path.join('node_modules', os.path.relpath(full, nm_dir)))
            count += 1

static_dir = os.path.join(base, '.next/static')
if os.path.isdir(static_dir):
    for root, dirs, files in os.walk(static_dir):
        for f in files:
            full = os.path.join(root, f)
            tf.add(full, arcname=os.path.join('.next', 'static', os.path.relpath(full, static_dir)))
            count += 1

pub_dir = os.path.join(base, 'public')
if os.path.isdir(pub_dir):
    for root, dirs, files in os.walk(pub_dir):
        for f in files:
            full = os.path.join(root, f)
            tf.add(full, arcname=os.path.join('public', os.path.relpath(full, pub_dir)))
            count += 1

prisma_dir = os.path.join(base, 'prisma')
if os.path.isdir(prisma_dir):
    for root, dirs, files in os.walk(prisma_dir):
        for f in files:
            if f.endswith(('.db', '.db-journal', '.db-wal', '.db-shm')):
                continue
            full = os.path.join(root, f)
            tf.add(full, arcname=os.path.join('prisma', os.path.relpath(full, prisma_dir)))
            count += 1

tf.close()
sz = os.path.getsize('deploy-aicrm.tar.gz') / 1024 / 1024
print(f'deploy-aicrm.tar.gz: {sz:.1f} MB ({count} files)')
