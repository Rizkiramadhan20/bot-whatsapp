const http = require("http");

function testAPI() {
  const data = JSON.stringify({
    to: "6281234567890",
    name: "Budi",
    amount: 100000,
  });

  const options = {
    hostname: "localhost",
    port: 3000,
    path: "/send-message",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = http.request(options, (res) => {
    let responseData = "";

    res.on("data", (chunk) => {
      responseData += chunk;
    });

    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", responseData);
    });
  });

  req.on("error", (error) => {
    console.error("Error:", error.message);
  });

  req.write(data);
  req.end();
}

testAPI();
