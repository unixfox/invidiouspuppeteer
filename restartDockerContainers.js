import Docker from "dockerode";
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

export default function main(url) {
    docker.listContainers(function (err, containers) {
        asyncForEach(containers, async (containerInfo) => {
            if (containerInfo.Names[0].substring(1).startsWith("invidious_invidious")) {
                docker.getContainer(containerInfo.Id).restart();
                await waitFor(10000);
            }
        })
    });
}

main();
