import axios from "axios";

export async function getIcebreakerData(fid: string) {
    try {
        const response = await axios.get(`https://api.icebreaker.xyz/fid/${fid}`);
        const data = response.data;

        const filteredData = data.filter(
            (item) => item.source === "IcebreakerEAS" && ["twitter", "linkedin", "telegram"].includes(item.type)
        );

        return filteredData;
    } catch (error) {
        console.error("Error fetching Icebreaker data:", error);
        return undefined;
    }
}
