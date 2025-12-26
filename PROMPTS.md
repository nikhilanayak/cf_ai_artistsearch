I have given a mockup and requirements for my artist search web app. Please create a boilerplate react app that uses mock data for the:
- Artist search page
    Input: {
        "src_artist",
        "src_genre",
        "target_genre"
    }

    Output: {
        "target_genre
    }

    For now, treat the API as a black box
- Chat page
    Input (Tool Call): {
        "src_artist,
        "src_genre",
        "target_artist",
        "target_genre"
    }

    Output (Tool Call): {
        document containing excerpts from each artist
    }

    You may keep the same model components as the initial weather app


====================================

Please help me create a subset of the original dataset (using python) that contains:
- Top G genres (by cum. song views)
- Top A artists per genre (by cum. song views)
- Top S songs per song (by song views)
The data schema is "title,tag,artist,year,views,features,lyrics,id"

====================================

I have uploaded the relevant documents for embeddings & retrieval to the CF dashboard. Please work with me to integrate these documents using the CF API so that I can implement the black boxes that were mentioned before (with the mock data).

====================================

Note: I also used the model to help debug specific errors in code, but these were less important (as it was more just "Suggest fixes to this error given XYZ" rather than "implement this feature")

For other features, I implemented these myself (with some boilerplate code from LLMs)