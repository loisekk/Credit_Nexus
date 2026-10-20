from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
import pandas as pd
import joblib


# Implementing the life span for the model
ml_model = {}


@asynccontextmanager
async def life_span(app : FastAPI):
    ml_model['model'] = joblib.load('credit_risk_model.pkl')
    ml_model['threshold'] = joblib.load('best_threshold.pkl')

    yield  # it will yield the model and threshold to the predict function
    ml_model.clear()


app = FastAPI(lifespan = life_span)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins = ['*'],
#     allow_credentials = True,
#     allow_methods = ['*'],
#     allow_headers = ['*']
# )

class loadModel(BaseModel):
    person_age : int
    person_income : float 
    person_home_ownership : str
    person_emp_length : float
    loan_intent : str
    loan_grade : str
    loan_amnt : float
    loan_int_rate : float 
    loan_percent_income: float
    cb_person_default_on_file : str
    cb_person_cred_hist_length : int


@app.get("/")
def greet():
    return {"message": "Server is live with FastAPI!"}


@app.post('/predict')
def predict(data : loadModel):
    input_df = pd.DataFrame([data.dict()]) # unpacked the data into a dictionary
    probability = ml_model['model'].predict_proba(input_df)[:,1][0] # getting the probability of default

    prediction =  int(probability >= ml_model['threshold'])
    return {
        "default_probability" : probability ,
        "default_prediction" : prediction,
        "threshold" : ml_model['threshold'],
        "Result" : "High risk" if prediction == 1 else "Low risk"
    }

app.mount('/',  StaticFiles(directory = 'static' , html = True), name = 'static')