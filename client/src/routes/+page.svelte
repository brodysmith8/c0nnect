<script lang="ts">
    import LoadingDots from "$lib/components/LoadingDots.svelte";
    
    let username = $state("");
    let serverId = $state("");
    let isLoading = $state(false);

    function onkeyup(event) {
        console.log(`name: ${event.target.id}\nvalue: ${event.target.value}\n`);
    }

    async function createServer(event) {
        isLoading = true;
        console.log(`POST url/api/v1/chatserver`);

        let res = await fetch("http://localhost:3000/api/v1/chatserver", {
            method: "POST"
        });
        let body = await res.json();
        
        const exampleSocket = new WebSocket(`ws://localhost:3000/chatserver/${body.serverId}`); // Send upgrade request 
        exampleSocket.onopen = () => {
            console.log("Connection opened!");
        }
        isLoading = false;
    }

    async function joinServer(event) {
        console.log(`GET url/api/v1/chatserver/serverId to get port number, then initiate TCP connection`);
        isLoading = true;
        let res = await fetch("http://localhost:3001/api/v1/healthcheck", {
            method: "GET"
        });
        let body = await res.json();
        isLoading = false;
    }
</script>

<div class="w-full max-w-full pl-2">
    <div class="w-full mb-4">
        <h1 class="font-mono font-bold text-2xl text-green-600">c0nnect</h1>
        <h1 class="font-mono">chat simply</h1>
    </div>
    <div class="max-w-1/3 w-1/3 flex flex-col gap-1">
        <div class="flex max-w-full">
            <input id="username-input" type="text" placeholder="username" class="border-2 w-full border-r-0 pl-2 font-mono" bind:value={username} {onkeyup} />
            <button class="border-2 px-2 bg-green-600 uppercase font-mono text-sm w-18 font-bold hover:cursor-pointer hover:bg-green-700">Set</button>
        </div>
        <div class="flex">
            <input id="serverId-input" type="text" placeholder="server ID" class="border-2 w-full border-r-0 pl-2 font-mono" bind:value={serverId} {onkeyup} />
            <button class="border-2 px-2 bg-green-600 uppercase font-mono text-sm w-18 font-bold hover:cursor-pointer hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-default"
                disabled={isLoading}>Join</button>
        </div>
        <div class="flex">
            <button class="border-2 px-2 bg-green-600 uppercase font-mono text-sm w-full font-bold hover:cursor-pointer hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-default" 
                disabled={(serverId === "" ? false:true) || isLoading} 
                onclick={createServer}>create server</button>
            <LoadingDots isLoading={isLoading} />
        </div>
    </div>
</div> 