import pandas as pd

def process_weather_data():
    print("Loading original weather.csv...")
    # 1. Load the raw daily weather dataset
    df = pd.read_csv('weather.csv')

    # 2. Handle missing Average Temperature (TAVG)
    # If TAVG is missing, calculate it using the midpoint of TMAX and TMIN
    print("Calculating missing temperatures...")
    df['TAVG_calc'] = df['TAVG'].fillna((df['TMAX'] + df['TMIN']) / 2)

    # 3. Aggregate daily data into annual summaries per station
    # Latitude, longitude, and elevation are static, so we group by them to keep them in the final dataset
    print("Aggregating daily records into annual totals/averages...")
    summary = df.groupby(['station', 'state', 'latitude', 'longitude', 'elevation']).agg(
        avg_temp=('TAVG_calc', 'mean'),  # Get the annual average temperature
        total_prcp=('PRCP', 'sum')       # Get the annual total precipitation
    ).reset_index()

    # 4. Drop any stations that are missing critical mapping or metric data
    summary = summary.dropna(subset=['latitude', 'longitude', 'avg_temp', 'total_prcp'])

    # 5. Define the 50 US States + DC 
    valid_states = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
    ]

    # 6. Filter out territories (like PR, GU) and border stations (like BC, ON)
    print("Filtering out non-US locations...")
    final_df = summary[summary['state'].isin(valid_states)]

    # 7. Export the final, web-ready dataset
    output_filename = 'weather_summary_us_only.csv'
    final_df.to_csv(output_filename, index=False)
    
    print(f"Success! Reduced {len(df)} daily rows to {len(final_df)} annual US station summaries.")
    print(f"Saved to {output_filename}")

if __name__ == "__main__":
    process_weather_data()