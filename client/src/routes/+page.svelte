<script lang="ts">
    import LoadingDots from "$lib/components/LoadingDots.svelte";
    import Button from "$lib/components/Button.svelte";
    
    let username = $state("");
    let serverId = $state("");
    let isLoading = $state(false);
    let isConnected = $state(false);
    let activeUsers = $state([]);
    let messageBuffer = $state("");
    let messages = $state([{ 
        username: "username1", 
        message: "This is a sample message"  
    }, {
        username: "username2", 
        message: "This is a second sample message that's quite a bit longer This is a second sample message that's quite a bit longer This is a second sample message that's quite a bit longer This is a second sample message that's quite a bit longer This is a second sample message that's quite a bit longer"  
    }, {
        username: "username3", 
        message: "This is a third sample message"  
    }]);
    let dataSocket: WebSocket;
    let messagesContainer;
    let latestMessage = $state({ username: "", message: "" });

    // Scroll to the bottom of the chat window when a new message comes in
    $effect(() => {
        let m = latestMessage;
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    async function createServer(event) {
        if (username.length === 0) {
            alert("Enter a username.");
            return;
        }

        isLoading = true;
        if (typeof dataSocket !== "undefined") {
            dataSocket.close();
        } 

        try {
            let res = await fetch("http://localhost:3000/api/v1/chatserver", {
                method: "POST",
                headers: {
                    'Accept': "application/json",
                    'Content-Type': "application/json"
                },
                body: JSON.stringify({ username: username })
            });
            let body = await res.json();
            serverId = body.serverId;
            joinServer();
        } catch (err) {
            console.error(err);
            alert("Unknown error creating ChatServer. Check the console.");
        }

        isLoading = false;
    }

    async function joinServer(event) {
        if (username.length === 0) {
            alert("Enter a username.");
            return;
        }

        if (serverId.length === 0) {
            alert("Enter a server ID.");
            return;
        }

        isLoading = true;

        if (typeof dataSocket !== "undefined") {
            // If we're already connected to a server, we should disconnect to it before connecting to this one
            dataSocket.close();
        } 

        try {
            let res = await fetch(`http://localhost:3000/api/v1/chatserver/${serverId}`, {
                method: "GET"
            });
            let body = await res.json();
            if (!body.chatServerExists) { 
                alert("Please enter a valid server ID.");
                isLoading = false;
                return;
            }

            dataSocket = new WebSocket(`ws://localhost:3000/chatserver/${serverId}/${username}`); // Send upgrade request 
            dataSocket.onopen = () => {
                isConnected = true;
                console.log("c0nnect data connection opened!");
            }
            dataSocket.onclose = () => {
                isConnected = false;
                console.log("c0nnect data connection closed!"); 
            }
            dataSocket.onmessage = (event) => {
                console.log(`received data: `, JSON.parse(event.data));
                let receivedMessage = JSON.parse(event.data);
                if (receivedMessage.activeUsers) activeUsers = receivedMessage.activeUsers; // Overwrite active users with current active users 
                if (receivedMessage.chatHistory) {
                    messages = receivedMessage.chatHistory; // Overwrite all messages with the historical chat
                    messages.push({ username: receivedMessage.username, status: receivedMessage.status }); // Include the message telling us we joined
                } else messages.push(receivedMessage); // Then we just got a single message
                latestMessage = receivedMessage;
            }
        } catch (err) {
            console.error(err);
            alert("Unknown error joining ChatServer. Check the console.");
        }

        isLoading = false;
    }

    async function sendMessage(event) {
        if (username.length === 0) {
            alert("Enter a username.");
            return;
        }
        
        if (messageBuffer.length === 0) {
            alert("Enter a message in the text box.");
            return;
        }
        
        if (typeof dataSocket === "undefined") {
            alert("Please join or start a server before sending a message.")
            return;
        } 

        dataSocket.send(JSON.stringify({ username: username, message: messageBuffer }));
    }

    async function disconnectServer(event) {
        if (typeof dataSocket !== "undefined") {
            dataSocket.close();
        }
    }
</script>

<div class="w-full max-w-full pl-2">
    <div class="w-full mb-4">
        <h1 class="font-mono font-bold text-4xl text-green-600">c0nnect</h1>
        <div class="flex">
            <h1 class="font-mono text-lg">chat simply</h1>
            <LoadingDots isLoading={true} />
        </div>
    </div>
    
    <div class="max-w-[512px] w-[512px]">
        <div class="flex flex-col gap-1 mb-4">
            <div class="flex max-w-full">
                <input id="username-input" type="text" placeholder="username" class="border-2 w-full pl-2 font-mono disabled:bg-gray-400" disabled={isLoading || isConnected} bind:value={username} />
                <!--<button class="border-2 px-2 bg-green-600 uppercase font-mono text-sm w-18 font-bold hover:cursor-pointer hover:bg-green-700">Set</button>-->
            </div>
            <div class="flex">
                <input id="serverId-input" type="text" placeholder="server ID" class="border-2 w-full border-r-0 pl-2 font-mono disabled:bg-gray-400" disabled={isLoading || isConnected} bind:value={serverId} />
                <Button disabled={isLoading || isConnected}
                    onclick={joinServer}
                    class={ "bg-green-600 hover:bg-green-700" }
                    width="w-18"
                    bind:value={serverId}>
                    join
                </Button>
            </div>
            <div class="flex">
                <Button disabled={isLoading} 
                    class={ { "bg-green-600 hover:bg-green-700": !isConnected, "bg-red-700 hover:bg-red-800": isConnected } }
                    onclick={isConnected ? disconnectServer : createServer }
                    width={"w-full"}
                >
                    { isConnected ? `disconnect from chat server${` ${serverId}`}` : "create server" }
                </Button>
            </div>
        </div>
        <div class="h-[512px] max-h-[512px] overflow-y-auto border-2 px-3" bind:this={messagesContainer}>
            <div class="flex w-full flex-col gap-3 py-1">
                {#each messages as message} 
                    <div class="w-full">
                        {#if message.status !== undefined}
                        <!-- A user joined or left -->
                        <p class="text-base/6">
                            <span class="font-mono text-sm/0 font-bold mr-2">{message.username} {message.status}</span>
                        </p>
                        {:else}
                        <p class="text-base/6">
                            <span class="font-mono text-sm/0 font-bold mr-2">{message.username}</span>
                            {message.message}
                        </p>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        <div class="flex">
            <input id="serverId-input" type="text" placeholder="share your message" class="border-2 w-full border-r-0 pl-2 pr-2 font-mono border-t-0 disabled:bg-gray-400" disabled={!isConnected} bind:value={messageBuffer} />
            <button class="border-2 px-2 bg-green-600 uppercase font-mono text-sm w-18 font-bold hover:cursor-pointer hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-default border-t-0"
                disabled={!isConnected}
                onclick={sendMessage}>Send</button>
        </div>
    </div>

</div> 