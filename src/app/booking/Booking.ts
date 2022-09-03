import {isMatching, match, P} from "ts-pattern";

export type BookingTime = {
    day: number;
    month: number;
    year: number;
    hour: number;
    minute: number;
}

export type CheckBookingRequest = {
    datetime: Date | BookingTime
}

export type CheckBookingResponse = {
    available: boolean;
}

export const Booking = {

    checkBooking(query: CheckBookingRequest, token: string) {
        return match(query.datetime)
            .with(P.instanceOf(Date), date => check(date, token))
            .with(P.when(isBookingTime), date => check(createBookingTime(date), token))
    }

}

const isBookingTime = isMatching({
    day: P.number,
    month: P.number,
    year: P.number,
    hour: P.number,
    minute: P.number
})

const createBookingTime = (bt: BookingTime): Date =>
    new Date(bt.year, bt.month, bt.day, bt.hour, bt.minute);

async function check(date: Date, token: string) {
    return await fetch("", {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(date),
    })
    .then((response) => response.json())
    .then((data) => {
        console.log('Success:', data);
        return data;
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}