const fs = require('fs');
const content = fs.readFileSync('src/views/TasksView.tsx', 'utf8');

const targetStr = `  const { showToast } = useToast();`;
const replaceStr = `  const { showToast } = useToast();

  const handleReprintTask = async (task: Task) => {
    if (!currentUid) return;
    try {
      const q1 = query(
        collection(db, \`users/\${currentUid}/activities\`),
        where('type', '==', 'meter_test')
      );
      
      const snapshot = await getDocs(q1);
      const activities = snapshot.docs.map(d => d.data() as any);
      
      activities.sort((a, b) => {
          const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.date).getTime();
          const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.date).getTime();
          return t2 - t1;
      });

      const match = activities.find(a => 
        (task.accountNumber && a.details?.accountNumber === task.accountNumber) ||
        (task.accountName && a.details?.testAccountName === task.accountName) ||
        (task.title && task.title.includes('Meter Test') && task.id === a.taskId)
      );

      if (match) {
        setReprintData(match);
        setTimeout(() => window.print(), 500);
      } else {
        showToast("No corresponding meter test form found.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Error finding form", "error");
    }
  };`;

fs.writeFileSync('src/views/TasksView.tsx', content.replace(targetStr, replaceStr));
